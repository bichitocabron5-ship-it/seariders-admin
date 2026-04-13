import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import {
  MonitorRunStatus,
  ReservationStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";

export const runtime = "nodejs";

export async function POST(_: Request, ctx: { params: Promise<{ assignmentId: string }> }) {
  const session = await requirePlatformOrAdmin({ allowStore: true });
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { assignmentId } = await ctx.params;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const readyAt = new Date();
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
              readyForPlatformAt: readyAt,
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
        data: {
          status: reservationStatus,
          ...(reservationStatus === ReservationStatus.READY_FOR_PLATFORM
            ? { readyForPlatformAt: readyAt }
            : {}),
        },
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
