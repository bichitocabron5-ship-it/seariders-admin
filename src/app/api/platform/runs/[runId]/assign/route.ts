// src/app/api/platform/runs/[runId]/assign/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { platformAssignmentBlockingReason } from "@/lib/operability";
import { assetCompatibilityReason, isAssetCompatibleWithServiceCategory } from "@/lib/platform-resource-compat";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import {
  MonitorRunKind,
  MonitorRunMode,
  MonitorRunStatus,
  ReservationStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";

export const runtime = "nodejs";

/**
 * En PRO:
 * - Se asigna a un run, pero queda QUEUED (sin startedAt/expectedEndAt) hasta /depart.
 * - JETSKI: requiere jetskiId
 * - NAUTICA: requiere assetId
 */
const Body = z.object({
  reservationUnitId: z.string().min(1),
  jetskiId: z.string().min(1).optional().nullable(),
  assetId: z.string().min(1).optional().nullable(),
});

function deriveReservationStatusFromUnits(
  units: Array<{ status: ReservationUnitStatus }>
): ReservationStatus {
  if (!units.length) return ReservationStatus.WAITING;

  if (units.some((u) => u.status === ReservationUnitStatus.IN_SEA)) return ReservationStatus.IN_SEA;
  if (units.some((u) => u.status === ReservationUnitStatus.READY_FOR_PLATFORM)) return ReservationStatus.READY_FOR_PLATFORM;
  if (units.some((u) => u.status === ReservationUnitStatus.WAITING)) return ReservationStatus.WAITING;

  if (units.every((u) => u.status === ReservationUnitStatus.COMPLETED)) return ReservationStatus.COMPLETED;
  if (units.every((u) => u.status === ReservationUnitStatus.CANCELED)) return ReservationStatus.CANCELED;

  return ReservationStatus.WAITING;
}

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { runId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      // Locks para evitar carreras
      await tx.$queryRaw`SELECT 1 FROM "MonitorRun" WHERE "id" = ${runId} FOR UPDATE`;
      await tx.$queryRaw`SELECT 1 FROM "ReservationUnit" WHERE "id" = ${b.reservationUnitId} FOR UPDATE`;
      if (b.jetskiId) await tx.$queryRaw`SELECT 1 FROM "Jetski" WHERE "id" = ${b.jetskiId} FOR UPDATE`;
      if (b.assetId) await tx.$queryRaw`SELECT 1 FROM "Asset" WHERE "id" = ${b.assetId} FOR UPDATE`;

      // 1) Run
      const run = await tx.monitorRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          kind: true,
          mode: true,
          status: true,
          monitorId: true,
          monitor: { select: { maxCapacity: true } },
          assignments: {
            where: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } },
            select: { id: true },
          },
        },
      });
      if (!run) throw new Error("Run no existe");

      if (run.status !== MonitorRunStatus.READY) {
        throw new Error(`Run no asignable en estado ${run.status}`);
      }

      const cap = run.mode === MonitorRunMode.MONITOR ? Number(run.monitor?.maxCapacity ?? 4) : 1;
      if ((run.assignments?.length ?? 0) >= cap) throw new Error(`Capacidad superada (${cap})`);

      // 2) Unit + Reserva
      const unit = await tx.reservationUnit.findUnique({
        where: { id: b.reservationUnitId },
        select: {
          id: true,
          status: true,
          reservationId: true,
          jetskiId: true,
          reservation: {
            select: {
              id: true,
              status: true,
              option: { select: { durationMinutes: true } },
              service: { select: { category: true, name: true } },
            },
          },
        },
      });
      if (!unit) throw new Error("ReservationUnit no existe");

      if (
        unit.reservation.status === ReservationStatus.CANCELED ||
        unit.reservation.status === ReservationStatus.COMPLETED
      ) {
        throw new Error(`Reserva no asignable (estado ${unit.reservation.status})`);
      }

      if (unit.status !== ReservationUnitStatus.READY_FOR_PLATFORM) {
        throw new Error(`Unit no está READY_FOR_PLATFORM (está ${unit.status})`);
      }

      // 3) Validación recurso según kind
      const duration = Math.max(1, Number(unit.reservation.option?.durationMinutes ?? 0));

      // Exclusividad global (recurso no puede estar QUEUED/ACTIVE en otro run)
      // - JETSKI: jetskiId
      // - NAUTICA: assetId
      if (run.kind === MonitorRunKind.JETSKI) {
        if (!b.jetskiId) throw new Error("Falta jetskiId para JETSKI");
        if (b.assetId) throw new Error("JETSKI no admite assetId");

        const jetski = await tx.jetski.findUnique({
          where: { id: b.jetskiId },
          select: {
            id: true,
            operabilityStatus: true,
            status: true,
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
          throw new Error("La moto no existe");
        }

        const blockReason = platformAssignmentBlockingReason({
          operabilityStatus: jetski.operabilityStatus,
          hasOpenMaintenanceEvent: Boolean(jetski.maintenanceEvents?.[0]),
          hasOpenIncident: Boolean(jetski.incidents?.[0]),
        });

        if (blockReason) {
          throw new Error(blockReason);
        }

        if (unit.jetskiId && unit.jetskiId !== b.jetskiId) {
          throw new Error("La unidad ya tiene un jetski asignado distinto");
        }

        const dup = await tx.monitorRunAssignment.findFirst({
          where: {
            jetskiId: b.jetskiId,
            status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
            run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
            endedAt: null,
          },
          select: { id: true },
        });
        if (dup) throw new Error("Esa moto ya está asignada en otra salida (pendiente o en mar)");

        // Crear assignment QUEUED (sin tiempos)
        const a = await tx.monitorRunAssignment.create({
          data: {
            runId,
            reservationId: unit.reservationId,
            reservationUnitId: unit.id,
            jetskiId: b.jetskiId,
            assetId: null,
            durationMinutesSnapshot: duration,
            status: RunAssignmentStatus.QUEUED,
            startedAt: null,
            expectedEndAt: null,
            endedAt: null,
          },
          select: {
            id: true,
            status: true,
            reservationUnitId: true,
            jetskiId: true,
            assetId: true,
            durationMinutesSnapshot: true,
            createdAt: true,
          },
        });

        // Guardar jetskiId en la unidad (sigue READY_FOR_PLATFORM hasta depart)
        await tx.reservationUnit.update({
          where: { id: unit.id },
          data: { jetskiId: b.jetskiId },
          select: { id: true },
        });

        const units = await tx.reservationUnit.findMany({
          where: { reservationId: unit.reservationId },
          select: { status: true },
        });
        const newStatus = deriveReservationStatusFromUnits(units);
        await tx.reservation.update({
          where: { id: unit.reservationId },
          data: { status: newStatus },
          select: { id: true },
        });

        return { ok: true, assignment: a };
      }

      // NAUTICA
      if (run.kind === MonitorRunKind.NAUTICA) {
        if (!b.assetId) throw new Error("Falta assetId para NAUTICA");
        if (b.jetskiId) throw new Error("NAUTICA no admite jetskiId");

        const asset = await tx.asset.findUnique({
          where: { id: b.assetId },
          select: {
            id: true,
            type: true,
            operabilityStatus: true,
            status: true,
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
          throw new Error("Asset no existe");
        }

        if (
          !isAssetCompatibleWithServiceCategory({
            assetType: asset.type,
            serviceCategory: unit.reservation.service?.category ?? null,
          })
        ) {
          throw new Error(
            assetCompatibilityReason(unit.reservation.service?.category ?? null) ??
              `El recurso no es compatible con ${unit.reservation.service?.name ?? "este servicio"}.`
          );
        }

        const blockReason = platformAssignmentBlockingReason({
          operabilityStatus: asset.operabilityStatus,
          hasOpenMaintenanceEvent: Boolean(asset.maintenanceEvents?.[0]),
          hasOpenIncident: Boolean(asset.incidents?.[0]),
        });

        if (blockReason) {
          throw new Error(blockReason);
        }

        const dup = await tx.monitorRunAssignment.findFirst({
          where: {
            assetId: b.assetId,
            status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
            run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
            endedAt: null,
          },
          select: { id: true },
        });
        if (dup) throw new Error("Ese recurso ya está asignado en otra salida (pendiente o en mar)");

        const a = await tx.monitorRunAssignment.create({
          data: {
            runId,
            reservationId: unit.reservationId,
            reservationUnitId: unit.id,
            jetskiId: null,
            assetId: b.assetId,
            durationMinutesSnapshot: duration,
            status: RunAssignmentStatus.QUEUED,
            startedAt: null,
            expectedEndAt: null,
            endedAt: null,
          },
          select: {
            id: true,
            status: true,
            reservationUnitId: true,
            jetskiId: true,
            assetId: true,
            durationMinutesSnapshot: true,
            createdAt: true,
          },
        });

        // En NAUTICA: NO tocamos unit.jetskiId
        const units = await tx.reservationUnit.findMany({
          where: { reservationId: unit.reservationId },
          select: { status: true },
        });
        const newStatus = deriveReservationStatusFromUnits(units);
        await tx.reservation.update({
          where: { id: unit.reservationId },
          data: { status: newStatus },
          select: { id: true },
        });

        return { ok: true, assignment: a };
      }

      throw new Error(`Run.kind no soportado: ${run.kind}`);
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
