import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { platformAssignmentBlockingReason } from "@/lib/operability";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";
import {
  MonitorRunKind,
  MonitorRunStatus,
  RunAssignmentStatus,
  ReservationStatus,
  ReservationUnitStatus,
} from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { runId } = await ctx.params;
  await req.text().catch(() => "");

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRun" WHERE "id" = ${runId} FOR UPDATE`;

      const run = await tx.monitorRun.findUnique({
        where: { id: runId },
        select: { id: true, status: true, kind: true, monitorAssetId: true },
      });
      if (!run) throw new Error("Run no existe");
      if (run.status === MonitorRunStatus.CLOSED) throw new Error("La salida está cerrada");
      if (run.status === MonitorRunStatus.IN_SEA) return { ok: true, already: true };

      if (run.kind === MonitorRunKind.NAUTICA && !run.monitorAssetId) {
        throw new Error("Salida Náutica sin recurso del monitor (monitorAssetId).");
      }

      const queued = await tx.monitorRunAssignment.findMany({
        where: { runId, status: RunAssignmentStatus.QUEUED },
        select: {
          id: true,
          reservationId: true,
          reservationUnitId: true,
          durationMinutesSnapshot: true,
          jetskiId: true,
          assetId: true,
        },
      });

      if (queued.length === 0) {
        throw new Error("No hay asignaciones pendientes (QUEUED) para iniciar la salida");
      }

      for (const assignment of queued) {
        if (assignment.jetskiId) {
          const jetski = await tx.jetski.findUnique({
            where: { id: assignment.jetskiId },
            select: {
              id: true,
              number: true,
              operabilityStatus: true,
              maintenanceEvents: {
                where: { status: { in: ["OPEN", "IN_PROGRESS", "EXTERNAL"] } },
                select: { id: true },
                take: 1,
              },
              incidents: {
                where: { isOpen: true },
                select: { id: true },
                take: 1,
              },
            },
          });

          if (!jetski) {
            throw new Error("Una de las motos asignadas ya no existe");
          }

          const blockReason = platformAssignmentBlockingReason({
            operabilityStatus: jetski.operabilityStatus,
            hasOpenMaintenanceEvent: Boolean(jetski.maintenanceEvents?.[0]),
            hasOpenIncident: Boolean(jetski.incidents?.[0]),
          });

          if (blockReason) {
            throw new Error(
              `No se puede iniciar la salida: la moto ${jetski.number}. ${blockReason}`
            );
          }
        }

        if (assignment.assetId) {
          const asset = await tx.asset.findUnique({
            where: { id: assignment.assetId },
            select: {
              id: true,
              name: true,
              operabilityStatus: true,
              maintenanceEvents: {
                where: { status: { in: ["OPEN", "IN_PROGRESS", "EXTERNAL"] } },
                select: { id: true },
                take: 1,
              },
              incidents: {
                where: { isOpen: true },
                select: { id: true },
                take: 1,
              },
            },
          });

          if (!asset) {
            throw new Error("Uno de los recursos asignados ya no existe");
          }

          const blockReason = platformAssignmentBlockingReason({
            operabilityStatus: asset.operabilityStatus,
            hasOpenMaintenanceEvent: Boolean(asset.maintenanceEvents?.[0]),
            hasOpenIncident: Boolean(asset.incidents?.[0]),
          });

          if (blockReason) {
            throw new Error(
              `No se puede iniciar la salida: el recurso ${asset.name}. ${blockReason}`
            );
          }
        }
      }

      const now = new Date();

      await tx.monitorRun.update({
        where: { id: runId },
        data: {
          status: MonitorRunStatus.IN_SEA,
          startedAt: now,
        },
        select: { id: true },
      });

      const touchedReservationIds = new Set<string>();

      for (const assignment of queued) {
        if (!assignment.reservationUnitId) {
          throw new Error("Assignment sin reservationUnitId (no debería pasar)");
        }

        const expectedEndAt = new Date(now.getTime() + assignment.durationMinutesSnapshot * 60_000);

        await tx.monitorRunAssignment.update({
          where: { id: assignment.id },
          data: {
            status: RunAssignmentStatus.ACTIVE,
            startedAt: now,
            expectedEndAt,
          },
          select: { id: true },
        });

        await tx.reservationUnit.update({
          where: { id: assignment.reservationUnitId },
          data: { status: ReservationUnitStatus.IN_SEA },
          select: { id: true },
        });

        touchedReservationIds.add(assignment.reservationId);
      }

      for (const reservationId of touchedReservationIds) {
        const units = await tx.reservationUnit.findMany({
          where: { reservationId },
          select: { status: true },
        });

        const newStatus = deriveReservationStatusFromUnits(units);

        await tx.reservation.update({
          where: { id: reservationId },
          data: {
            status: newStatus,
            departureAt: newStatus === ReservationStatus.IN_SEA ? now : undefined,
          },
          select: { id: true },
        });
      }

      return { ok: true, activated: queued.length };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
