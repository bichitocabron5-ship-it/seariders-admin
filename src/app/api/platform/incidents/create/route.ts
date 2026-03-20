// src/app/api/platform/incidents/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  IncidentLevel,
  IncidentStatus,
  IncidentType,
  MaintenanceEntityType,
  MaintenanceEventType,
  MaintenanceSeverity,
  MaintenanceStatus,
  PlatformOperabilityStatus,
  MaintenanceEventLogKind,
} from "@prisma/client";
import { createMaintenanceEventLog } from "@/lib/mechanics-event-log";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Body = z.object({
  entityType: z.nativeEnum(MaintenanceEntityType),
  entityId: z.string().min(1),

  type: z.nativeEnum(IncidentType),
  level: z.nativeEnum(IncidentLevel).optional().default(IncidentLevel.MEDIUM),
  description: z.string().trim().max(2000).optional().nullable(),

  affectsOperability: z.boolean().optional().default(true),
  operabilityStatus: z.nativeEnum(PlatformOperabilityStatus).optional().nullable(),

  retainDeposit: z.boolean().optional().default(false),
  retainDepositCents: z.coerce.number().int().min(0).optional().nullable(),

  createMaintenanceEvent: z.boolean().optional().default(true),
});

function mapIncidentLevelToMaintenanceSeverity(level: IncidentLevel): MaintenanceSeverity {
  if (level === IncidentLevel.CRITICAL) return MaintenanceSeverity.CRITICAL;
  if (level === IncidentLevel.HIGH) return MaintenanceSeverity.HIGH;
  if (level === IncidentLevel.MEDIUM) return MaintenanceSeverity.MEDIUM;
  return MaintenanceSeverity.LOW;
}

export async function POST(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    entityType,
    entityId,
    type,
    level,
    description,
    affectsOperability,
    operabilityStatus,
    retainDeposit,
    retainDepositCents,
    createMaintenanceEvent,
  } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let jetskiId: string | null = null;
      let assetId: string | null = null;
      let hoursAtService = 0;

      if (entityType === MaintenanceEntityType.JETSKI) {
        const jetski = await tx.jetski.findUnique({
          where: { id: entityId },
          select: {
            id: true,
            currentHours: true,
          },
        });

        if (!jetski) throw new Error("Jetski no existe");

        jetskiId = jetski.id;
        hoursAtService = Number(jetski.currentHours ?? 0);
      } else {
        const asset = await tx.asset.findUnique({
          where: { id: entityId },
          select: {
            id: true,
            currentHours: true,
          },
        });

        if (!asset) throw new Error("Asset no existe");

        assetId = asset.id;
        hoursAtService = Number(asset.currentHours ?? 0);
      }

      const finalOperabilityStatus =
        affectsOperability
          ? operabilityStatus ?? PlatformOperabilityStatus.DAMAGED
          : null;

      const incident = await tx.incident.create({
        data: {
          entityType,
          jetskiId,
          assetId,
          type,
          level,
          status: createMaintenanceEvent ? IncidentStatus.LINKED : IncidentStatus.OPEN,
          description: description?.trim() || null,
          affectsOperability,
          operabilityStatus: finalOperabilityStatus,
          retainDeposit,
          retainDepositCents: retainDeposit ? retainDepositCents ?? null : null,
          createdByUserId: session.userId,
        },
        select: {
          id: true,
          entityType: true,
          type: true,
          level: true,
          status: true,
          affectsOperability: true,
          operabilityStatus: true,
          retainDeposit: true,
          retainDepositCents: true,
          description: true,
        },
      });

      if (affectsOperability && finalOperabilityStatus) {
        if (jetskiId) {
          await tx.jetski.update({
            where: { id: jetskiId },
            data: {
              operabilityStatus: finalOperabilityStatus,
            },
          });
        }

        if (assetId) {
          await tx.asset.update({
            where: { id: assetId },
            data: {
              operabilityStatus: finalOperabilityStatus,
            },
          });
        }
      }

      let maintenanceEventId: string | null = null;

      if (createMaintenanceEvent) {
        const ev = await tx.maintenanceEvent.create({
          data: {
            entityType,
            jetskiId,
            assetId,
            type: MaintenanceEventType.INCIDENT_REVIEW,
            status: MaintenanceStatus.OPEN,
            severity: mapIncidentLevelToMaintenanceSeverity(level),
            hoursAtService,
            note: description?.trim()
              ? `Incidencia desde Plataforma: ${description.trim()}`
              : `Incidencia desde Plataforma (${type})`,
            createdByUserId: session.userId,
            affectsOperability,
            operabilityOnOpen: finalOperabilityStatus,
            operabilityOnResolved: PlatformOperabilityStatus.OPERATIONAL,
          },
          select: {
            id: true,
          },
        });

        maintenanceEventId = ev.id;

        await tx.incident.update({
          where: { id: incident.id },
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
            incidentId: incident.id,
            incidentType: type,
            incidentLevel: level,
            affectsOperability,
            operabilityStatus: finalOperabilityStatus,
            retainDeposit,
            retainDepositCents: retainDepositCents ?? null,
          },
        });
      }

      return {
        ok: true,
        incidentId: incident.id,
        maintenanceEventId,
      };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
