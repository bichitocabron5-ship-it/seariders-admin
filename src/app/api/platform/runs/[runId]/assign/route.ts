// src/app/api/platform/runs/[runId]/assign/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { platformAssignmentBlockingReason } from "@/lib/operability";
import { assetCompatibilityReason, isAssetCompatibleWithServiceCategory } from "@/lib/platform-resource-compat";
import { canShareMonitorAssetWithReservation } from "@/lib/platform-shared-resource";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { getOperationalDurationMinutes } from "@/lib/reservation-operations";
import { getRequestOperationalContext, writeOperationalLog } from "@/lib/operational-log";
import { buildPlatformMutationDeltaTx } from "@/lib/platform-board-delta-server";
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

const OPEN_ASSIGNMENT_STATUSES: RunAssignmentStatus[] = [
  RunAssignmentStatus.QUEUED,
  RunAssignmentStatus.ACTIVE,
];
const OPEN_RUN_STATUSES: MonitorRunStatus[] = [
  MonitorRunStatus.READY,
  MonitorRunStatus.IN_SEA,
];

type RunConflictInfo = {
  id: string;
  status: string;
  kind?: string | null;
  mode?: string | null;
};

type AssignmentConflictInfo = {
  id: string;
  status: string;
  run: RunConflictInfo;
  reservationUnit?: { unitIndex: number | null; serviceName: string | null } | null;
  reservation?: { customerName: string | null } | null;
  jetski?: { number: number | null } | null;
  asset?: { name: string | null; type: string | null } | null;
};

function shortId(id: string | null | undefined) {
  return id ? id.slice(-8) : "-";
}

function formatRunConflict(run: RunConflictInfo) {
  return `${shortId(run.id)} (${run.kind ?? "RUN"} ${run.mode ?? ""}, ${run.status})`;
}

function formatAssignmentResource(assignment: AssignmentConflictInfo) {
  if (assignment.jetski) return `moto ${assignment.jetski.number ?? shortId(assignment.id)}`;
  if (assignment.asset) {
    return `${assignment.asset.name ?? "recurso"}${assignment.asset.type ? ` (${assignment.asset.type})` : ""}`;
  }
  return `assignment ${shortId(assignment.id)}`;
}

function formatAssignmentConflict(assignment: AssignmentConflictInfo) {
  const customer = assignment.reservation?.customerName?.trim();
  const service = assignment.reservationUnit?.serviceName?.trim();
  const unitIndex = assignment.reservationUnit?.unitIndex;
  const unitLabel = unitIndex ? `unidad ${unitIndex}` : "unidad";

  return [
    `${unitLabel}: ${formatAssignmentResource(assignment)}`,
    service ? `servicio ${service}` : null,
    customer ? `cliente ${customer}` : null,
    `salida ${formatRunConflict(assignment.run)}`,
    `assignment ${shortId(assignment.id)} ${assignment.status}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatMonitorResourceConflict(
  resourceLabel: string,
  run: RunConflictInfo
) {
  return `${resourceLabel} está como recurso base en salida ${formatRunConflict(run)}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const requestContext = getRequestOperationalContext(req);
  const auditSource = session.role === "ADMIN" ? "ADMIN" : "PLATFORM";

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
          monitorJetskiId: true,
          monitorAssetId: true,
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

      const assignmentCap =
        run.mode === MonitorRunMode.MONITOR
          ? Number(run.monitor?.maxCapacity ?? 4)
          : run.mode === MonitorRunMode.TEST
            ? 1
            : null;
      if (assignmentCap !== null && (run.assignments?.length ?? 0) >= assignmentCap) {
        throw new Error(`Capacidad superada (${assignmentCap})`);
      }

      // 2) Unit + Reserva
      const unit = await tx.reservationUnit.findUnique({
        where: { id: b.reservationUnitId },
        select: {
          id: true,
          unitIndex: true,
          status: true,
          reservationId: true,
          jetskiId: true,
          serviceCategory: true,
          serviceName: true,
          durationMinutesSnapshot: true,
          quantitySnapshot: true,
          paxSnapshot: true,
          reservation: {
            select: {
              id: true,
              status: true,
              isLicense: true,
              customerName: true,
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

      const activeUnitAssignment = await tx.monitorRunAssignment.findFirst({
        where: {
          reservationUnitId: unit.id,
          status: { in: OPEN_ASSIGNMENT_STATUSES },
          run: { status: { in: OPEN_RUN_STATUSES } },
          endedAt: null,
        },
        select: {
          id: true,
          status: true,
          run: { select: { id: true, kind: true, mode: true, status: true } },
          reservationUnit: {
            select: {
              unitIndex: true,
              serviceName: true,
            },
          },
          reservation: {
            select: {
              customerName: true,
            },
          },
          jetski: { select: { number: true } },
          asset: { select: { name: true, type: true } },
        },
      });

      if (activeUnitAssignment) {
        throw new Error(
          `La reserva ya tiene una unidad activa asignada: ${formatAssignmentConflict(activeUnitAssignment)}. Finaliza o desasigna esa salida antes de reasignar.`
        );
      }

      // 3) Validación recurso según kind
      const duration = getOperationalDurationMinutes({
        category: unit.serviceCategory ?? null,
        durationMinutes: unit.durationMinutesSnapshot ?? 0,
        quantity: unit.quantitySnapshot ?? 1,
      });

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
            number: true,
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

        const dup = await tx.monitorRunAssignment.findFirst({
          where: {
            jetskiId: b.jetskiId,
            status: { in: OPEN_ASSIGNMENT_STATUSES },
            run: { status: { in: OPEN_RUN_STATUSES } },
            endedAt: null,
          },
          select: {
            id: true,
            status: true,
            run: { select: { id: true, kind: true, mode: true, status: true } },
            reservationUnit: { select: { unitIndex: true, serviceName: true } },
            reservation: { select: { customerName: true } },
            jetski: { select: { number: true } },
            asset: { select: { name: true, type: true } },
          },
        });
        if (dup) {
          throw new Error(
            `Esa moto ya está asignada en una salida abierta: ${formatAssignmentConflict(dup)}`
          );
        }

        const busyMonitorRun = await tx.monitorRun.findFirst({
          where: {
            monitorJetskiId: b.jetskiId,
            status: { in: OPEN_RUN_STATUSES },
          },
          select: { id: true, kind: true, mode: true, status: true },
        });
        if (busyMonitorRun) {
          throw new Error(
            formatMonitorResourceConflict(`La moto ${jetski.number ?? shortId(jetski.id)}`, busyMonitorRun)
          );
        }

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
            reservation: {
              select: {
                customerName: true,
                pax: true,
                quantity: true,
                service: { select: { name: true, category: true } },
                option: { select: { durationMinutes: true } },
              },
            },
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

        await writeOperationalLog(
          {
            action: "PLATFORM_ASSIGN",
            entityType: "MONITOR_RUN_ASSIGNMENT",
            entityId: a.id,
            source: auditSource,
            actor: { userId: session.userId },
            request: requestContext,
            metadata: {
              runId,
              runKind: run.kind,
              reservationId: unit.reservationId,
              reservationUnitId: unit.id,
              jetskiId: b.jetskiId,
              assetId: null,
              durationMinutes: duration,
              assignmentStatus: a.status,
            },
          },
          tx
        );

        const delta = await buildPlatformMutationDeltaTx(tx, {
          mutation: "assign",
          runId,
          assignmentIds: [a.id],
          reservationUnitIds: [unit.id],
          reservationIds: [unit.reservationId],
          removedQueueUnitIds: [unit.id],
        });

        return { ok: true, assignment: a, delta };
      }

      // NAUTICA
      if (run.kind === MonitorRunKind.NAUTICA) {
        if (!b.assetId) throw new Error("Falta assetId para NAUTICA");
        if (b.jetskiId) throw new Error("NAUTICA no admite jetskiId");

        const asset = await tx.asset.findUnique({
          where: { id: b.assetId },
          select: {
            id: true,
            name: true,
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
            serviceCategory: unit.serviceCategory ?? null,
          })
        ) {
          throw new Error(
            assetCompatibilityReason(unit.serviceCategory ?? null) ??
              `El recurso no es compatible con ${unit.serviceName ?? "este servicio"}.`
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

        const allowSharedMonitorAsset =
          run.monitorAssetId === b.assetId &&
          canShareMonitorAssetWithReservation({
            runKind: run.kind,
            runMode: run.mode,
            serviceCategory: unit.serviceCategory ?? null,
            isLicense: unit.reservation.isLicense,
          });

        const dup = await tx.monitorRunAssignment.findFirst({
          where: {
            assetId: b.assetId,
            status: { in: OPEN_ASSIGNMENT_STATUSES },
            run: { status: { in: OPEN_RUN_STATUSES } },
            endedAt: null,
            ...(allowSharedMonitorAsset
              ? {
                  OR: [{ runId: { not: runId } }, { runId, reservationUnitId: { not: unit.id } }],
                }
              : {}),
          },
          select: {
            id: true,
            status: true,
            run: { select: { id: true, kind: true, mode: true, status: true } },
            reservationUnit: { select: { unitIndex: true, serviceName: true } },
            reservation: { select: { customerName: true } },
            jetski: { select: { number: true } },
            asset: { select: { name: true, type: true } },
          },
        });
        if (dup) {
          throw new Error(
            `Ese recurso ya está asignado en una salida abierta: ${formatAssignmentConflict(dup)}`
          );
        }

        const busyMonitorRun = await tx.monitorRun.findFirst({
          where: {
            monitorAssetId: b.assetId,
            status: { in: OPEN_RUN_STATUSES },
            ...(allowSharedMonitorAsset ? { id: { not: runId } } : {}),
          },
          select: { id: true, kind: true, mode: true, status: true },
        });
        if (busyMonitorRun) {
          throw new Error(
            formatMonitorResourceConflict(`El recurso ${asset.name ?? shortId(asset.id)}`, busyMonitorRun)
          );
        }

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
            reservation: {
              select: {
                customerName: true,
                pax: true,
                quantity: true,
                service: { select: { name: true, category: true } },
                option: { select: { durationMinutes: true } },
              },
            },
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

        await writeOperationalLog(
          {
            action: "PLATFORM_ASSIGN",
            entityType: "MONITOR_RUN_ASSIGNMENT",
            entityId: a.id,
            source: auditSource,
            actor: { userId: session.userId },
            request: requestContext,
            metadata: {
              runId,
              runKind: run.kind,
              reservationId: unit.reservationId,
              reservationUnitId: unit.id,
              jetskiId: null,
              assetId: b.assetId,
              durationMinutes: duration,
              assignmentStatus: a.status,
            },
          },
          tx
        );

        const delta = await buildPlatformMutationDeltaTx(tx, {
          mutation: "assign",
          runId,
          assignmentIds: [a.id],
          reservationUnitIds: [unit.id],
          reservationIds: [unit.reservationId],
          removedQueueUnitIds: [unit.id],
        });

        return { ok: true, assignment: a, delta };
      }

      throw new Error(`Run.kind no soportado: ${run.kind}`);
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
