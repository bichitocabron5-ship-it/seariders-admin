// src/app/api/platform/assignments/[assignmentId]/finish/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";

import {
  MonitorRunStatus,
  RunAssignmentStatus,
  ReservationStatus,
  ReservationUnitStatus,
  IncidentType,
  IncidentLevel,
  MaintenanceSeverity,
  PlatformOperabilityStatus,
  MaintenanceEventLogKind,
} from "@prisma/client";

import { createMaintenanceEventLog } from "@/lib/mechanics-event-log";
import { diffHours } from "@/lib/mechanics";

export const runtime = "nodejs";

const Body = z.object({
  endedAt: z.string().datetime().optional().nullable(),
  hasIncident: z.boolean().default(false),

  type: z.nativeEnum(IncidentType).optional(),
  level: z.nativeEnum(IncidentLevel).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(800).optional().nullable(),

  affectsOperability: z.boolean().optional(),
  operabilityStatus: z
    .enum(["OPERATIONAL", "MAINTENANCE", "DAMAGED", "OUT_OF_SERVICE"])
    .optional()
    .nullable(),

  retainDeposit: z.boolean().optional().default(false),
  retainDepositCents: z.coerce.number().int().min(0).optional().nullable(),

  createMaintenanceEvent: z.boolean().optional().default(true),
});

function mapIncidentLevelToMaintenanceSeverity(
  level: IncidentLevel
): MaintenanceSeverity {
  if (level === IncidentLevel.CRITICAL) return MaintenanceSeverity.CRITICAL;
  if (level === IncidentLevel.HIGH) return MaintenanceSeverity.HIGH;
  if (level === IncidentLevel.MEDIUM) return MaintenanceSeverity.MEDIUM;
  return MaintenanceSeverity.LOW;
}

function defaultOperabilityFromIncidentLevel(
  level: IncidentLevel
): PlatformOperabilityStatus {
  if (level === IncidentLevel.CRITICAL) {
    return PlatformOperabilityStatus.OUT_OF_SERVICE;
  }
  if (level === IncidentLevel.HIGH) {
    return PlatformOperabilityStatus.DAMAGED;
  }
  if (level === IncidentLevel.MEDIUM) {
    return PlatformOperabilityStatus.MAINTENANCE;
  }
  return PlatformOperabilityStatus.OPERATIONAL;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  const session = await requirePlatformOrAdmin({ allowStore: true });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { assignmentId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Body inválido", { status: 400 });
  }

  const b = parsed.data;

  if (b.hasIncident) {
    if (!b.type) return new NextResponse("Falta type de incidencia", { status: 400 });
    if (!b.level) return new NextResponse("Falta level de incidencia", { status: 400 });
  }

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1
        FROM "MonitorRunAssignment"
        WHERE "id" = ${assignmentId}
        FOR UPDATE
      `;

      const a = await tx.monitorRunAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          reservationId: true,
          runId: true,
          jetskiId: true,
          assetId: true,
          durationMinutesSnapshot: true,
          reservationUnitId: true,

          run: {
            select: {
              id: true,
              status: true,
              monitorId: true,
            },
          },
          reservation: {
            select: {
              id: true,
              status: true,
            },
          },
          jetski: {
            select: {
              id: true,
              currentHours: true,
              operabilityStatus: true,
            },
          },
          asset: {
            select: {
              id: true,
              name: true,
              currentHours: true,
              operabilityStatus: true,
            },
          },
        },
      });

      if (!a) throw new Error("Assignment no existe");

      if (a.status === RunAssignmentStatus.FINISHED) {
        return { ok: true, assignmentId: a.id, alreadyFinished: true };
      }

      if (a.status !== RunAssignmentStatus.ACTIVE) {
        throw new Error("Solo se puede finalizar si está ACTIVE (en el mar).");
      }

      const OPEN_RUN_STATUSES = new Set<MonitorRunStatus>([
        MonitorRunStatus.READY,
        MonitorRunStatus.IN_SEA,
      ]);

      if (!OPEN_RUN_STATUSES.has(a.run.status)) {
        throw new Error("La salida no está abierta");
      }

      const endedAt = b.endedAt ? new Date(b.endedAt) : new Date();

      const updatedAssignment = await tx.monitorRunAssignment.update({
        where: { id: a.id },
        data: {
          status: RunAssignmentStatus.FINISHED,
          endedAt,
        },
        select: { id: true, status: true, endedAt: true },
      });

      const hoursToAdd =
        a.startedAt instanceof Date
          ? diffHours(a.startedAt, endedAt)
          : 0;
      const fallbackHoursToAdd =
        hoursToAdd > 0
          ? hoursToAdd
          : diffHours(
              new Date(endedAt.getTime() - Number(a.durationMinutesSnapshot ?? 0) * 60_000),
              endedAt
            );
      const nextJetskiCurrentHours =
        a.jetski?.currentHours != null
          ? Number(a.jetski.currentHours) + fallbackHoursToAdd
          : null;
      const nextAssetCurrentHours =
        a.asset?.currentHours != null
          ? Number(a.asset.currentHours) + fallbackHoursToAdd
          : null;

      if (a.jetskiId && nextJetskiCurrentHours != null) {
        await tx.jetski.update({
          where: { id: a.jetskiId },
          data: {
            currentHours: nextJetskiCurrentHours,
          },
          select: { id: true },
        });
      }

      if (a.assetId && nextAssetCurrentHours != null) {
        await tx.asset.update({
          where: { id: a.assetId },
          data: {
            currentHours: nextAssetCurrentHours,
          },
          select: { id: true },
        });
      }

      let incidentId: string | null = null;
      let maintenanceEventId: string | null = null;

    if (b.hasIncident) {
      const affectsOperability =
        b.affectsOperability !== undefined ? b.affectsOperability : true;

      const finalOperabilityStatus = affectsOperability
        ? (b.operabilityStatus ?? defaultOperabilityFromIncidentLevel(b.level!))
        : "OPERATIONAL";

      const inc = await tx.incident.create({
        data: {
          runId: a.runId,
          reservationId: a.reservationId,
          assignmentId: a.id,
          jetskiId: a.jetskiId ?? null,
          assetId: a.assetId ?? null,
          reservationUnitId: a.reservationUnitId ?? null,

          entityType: a.jetskiId ? "JETSKI" : "ASSET",

          type: b.type!,
          level: b.level!,
          status: b.createMaintenanceEvent ? "LINKED" : "OPEN",

          description: b.description?.trim() || null,
          notes: b.notes?.trim() || null,

          isOpen: true,
          closedAt: null,

          affectsOperability,
          operabilityStatus: finalOperabilityStatus,
          retainDeposit: b.retainDeposit ?? false,
          retainDepositCents: b.retainDeposit ? b.retainDepositCents ?? null : null,

          createdByUserId: session.userId,
        },
        select: { id: true },
      });

      incidentId = inc.id;

        if (b.retainDeposit) {
          await tx.reservation.update({
            where: { id: a.reservationId },
            data: {
              depositHeld: true,
              depositHoldReason:
                b.description?.trim() ||
                b.notes?.trim() ||
                `Incidencia ${b.type} registrada desde Plataforma`,
            },
            select: { id: true },
          });
        }
        
      if (affectsOperability && finalOperabilityStatus) {
        if (a.jetskiId) {
          await tx.jetski.update({
            where: { id: a.jetskiId },
            data: {
              operabilityStatus: finalOperabilityStatus,
            },
            select: { id: true },
          });
        }

        if (a.assetId) {
          await tx.asset.update({
            where: { id: a.assetId },
            data: {
              operabilityStatus: finalOperabilityStatus,
            },
            select: { id: true },
          });
        }
      }

      if (b.createMaintenanceEvent) {
        const ev = await tx.maintenanceEvent.create({
          data: {
            entityType: a.jetskiId ? "JETSKI" : "ASSET",
            jetskiId: a.jetskiId ?? null,
            assetId: a.assetId ?? null,

            type: "INCIDENT_REVIEW",
            status: "OPEN",
            severity: mapIncidentLevelToMaintenanceSeverity(b.level!),

            hoursAtService:
              a.jetskiId
                ? Number(nextJetskiCurrentHours ?? a.jetski?.currentHours ?? 0)
                : Number(nextAssetCurrentHours ?? a.asset?.currentHours ?? 0),
            note: b.description?.trim()
              ? `Incidencia desde Plataforma: ${b.description.trim()}`
              : b.notes?.trim()
                ? `Incidencia desde Plataforma: ${b.notes.trim()}`
                : `Incidencia desde Plataforma (${b.type})`,

            createdByUserId: session.userId,

            affectsOperability,
            operabilityOnOpen: finalOperabilityStatus,
            operabilityOnResolved: "OPERATIONAL",
          },
          select: { id: true },
        });

        maintenanceEventId = ev.id;

        await tx.incident.update({
          where: { id: inc.id },
          data: {
            maintenanceEventId: ev.id,
          },
        });

        await createMaintenanceEventLog({
          tx,
          maintenanceEventId: ev.id,
          kind: MaintenanceEventLogKind.CREATED,
          message: "Evento creado automáticamente desde incidencia de Plataforma",
          createdByUserId: session.userId,
          payloadJson: {
            incidentId: inc.id,
            incidentType: b.type!,
            incidentLevel: b.level!,
            description: b.description?.trim() || null,
            affectsOperability,
            operabilityStatus: finalOperabilityStatus,
            retainDeposit: b.retainDeposit ?? false,
            retainDepositCents: b.retainDepositCents ?? null,
          },
        });
      }
    }

      if (a.reservationUnitId) {
        await tx.reservationUnit.updateMany({
          where: { id: a.reservationUnitId },
          data: { status: ReservationUnitStatus.WAITING },
        });
      }

      const units = await tx.reservationUnit.findMany({
        where: { reservationId: a.reservationId },
        select: { status: true },
      });

      const newStatus = deriveReservationStatusFromUnits(units);

      await tx.reservation.update({
        where: { id: a.reservationId },
        data: {
          status: newStatus,
          arrivalAt:
            newStatus === ReservationStatus.WAITING ? new Date() : null,
        },
        select: { id: true },
      });

    const remainingAssignments = await tx.monitorRunAssignment.findMany({
      where: {
        runId: a.runId,
        status: {
          in: [RunAssignmentStatus.ACTIVE, RunAssignmentStatus.QUEUED],
        },
      },
      select: { id: true },
    });

    if (remainingAssignments.length === 0) {
      await tx.monitorRun.update({
        where: { id: a.runId },
        data: {
          status: MonitorRunStatus.READY,
        },
        select: { id: true },
      });
    }

      return {
        ok: true,
        assignmentId: updatedAssignment.id,
        endedAt: updatedAssignment.endedAt,
        incidentId,
        maintenanceEventId,
        reservationId: a.reservationId,
        jetskiId: a.jetskiId,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
