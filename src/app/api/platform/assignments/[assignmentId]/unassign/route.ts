import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import {
  MonitorRunStatus,
  ReservationStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";

export const runtime = "nodejs";

function deriveReservationStatusFromUnits(
  units: Array<{ status: ReservationUnitStatus }>
): ReservationStatus {
  if (!units.length) return ReservationStatus.WAITING;

  if (units.some((u) => u.status === ReservationUnitStatus.IN_SEA)) {
    return ReservationStatus.IN_SEA;
  }
  if (units.some((u) => u.status === ReservationUnitStatus.READY_FOR_PLATFORM)) {
    return ReservationStatus.READY_FOR_PLATFORM;
  }
  if (units.some((u) => u.status === ReservationUnitStatus.WAITING)) {
    return ReservationStatus.WAITING;
  }
  if (units.every((u) => u.status === ReservationUnitStatus.COMPLETED)) {
    return ReservationStatus.COMPLETED;
  }
  if (units.every((u) => u.status === ReservationUnitStatus.CANCELED)) {
    return ReservationStatus.CANCELED;
  }

  return ReservationStatus.WAITING;
}

export async function POST(_: Request, ctx: { params: Promise<{ assignmentId: string }> }) {
  const session = await requirePlatformOrAdmin({ allowStore: true });
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { assignmentId } = await ctx.params;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1
        FROM "MonitorRunAssignment"
        WHERE "id" = ${assignmentId}
        FOR UPDATE
      `;

      const assignment = await tx.monitorRunAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          status: true,
          runId: true,
          reservationId: true,
          reservationUnitId: true,
          jetskiId: true,
          run: { select: { id: true, status: true } },
        },
      });

      if (!assignment) throw new Error("Assignment no existe");

      if (
        assignment.run.status === MonitorRunStatus.IN_SEA &&
        assignment.status !== RunAssignmentStatus.QUEUED
      ) {
        throw new Error("No se puede desasignar cliente con la salida en IN_SEA");
      }

      if (assignment.status === RunAssignmentStatus.FINISHED) {
        return { ok: true, assignmentId: assignment.id, alreadyUnassigned: true };
      }

      await tx.monitorRunAssignment.delete({ where: { id: assignment.id } });

      if (assignment.reservationUnitId) {
        await tx.$queryRaw`
          SELECT 1
          FROM "ReservationUnit"
          WHERE "id" = ${assignment.reservationUnitId}
          FOR UPDATE
        `;

        const unit = await tx.reservationUnit.findUnique({
          where: { id: assignment.reservationUnitId },
          select: { id: true, jetskiId: true },
        });

        if (unit) {
          await tx.reservationUnit.update({
            where: { id: unit.id },
            data: {
              status: ReservationUnitStatus.READY_FOR_PLATFORM,
              jetskiId:
                assignment.jetskiId && unit.jetskiId === assignment.jetskiId
                  ? null
                  : unit.jetskiId,
            },
            select: { id: true },
          });
        }
      }

      const units = await tx.reservationUnit.findMany({
        where: { reservationId: assignment.reservationId },
        select: { status: true },
      });

      const reservationStatus = deriveReservationStatusFromUnits(units);
      await tx.reservation.update({
        where: { id: assignment.reservationId },
        data: { status: reservationStatus },
        select: { id: true },
      });

      return { ok: true, assignmentId: assignment.id, runId: assignment.runId };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
