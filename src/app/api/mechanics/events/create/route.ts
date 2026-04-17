// src/app/api/mechanics/events/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  MaintenanceEntityType,
  MaintenanceEventType,
  MaintenanceSeverity,
  MaintenanceStatus,
  SparePartMovementType,
  MaintenanceEventLogKind,
  PlatformOperabilityStatus,
} from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";
import { createMaintenanceEventLog } from "@/lib/mechanics-event-log";

export const runtime = "nodejs";

const Body = z.object({
  entityType: z.nativeEnum(MaintenanceEntityType),
  entityId: z.string().min(1),
  type: z
    .nativeEnum(MaintenanceEventType)
    .optional()
    .default(MaintenanceEventType.SERVICE),
  hoursAtService: z.coerce.number().finite().min(0).optional(),
  note: z.string().max(1000).optional().nullable(),
  applyToEntity: z.boolean().optional().default(true),

  severity: z
    .nativeEnum(MaintenanceSeverity)
    .optional()
    .default(MaintenanceSeverity.MEDIUM),
  status: z
    .nativeEnum(MaintenanceStatus)
    .optional()
    .default(MaintenanceStatus.RESOLVED),
  supplierName: z.string().trim().max(120).optional().nullable(),
  externalWorkshop: z.boolean().optional().default(false),
  costCents: z.coerce.number().int().min(0).optional().nullable(),
  laborCostCents: z.coerce.number().int().min(0).optional().nullable(),
  partsCostCents: z.coerce.number().int().min(0).optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  faultCode: z.string().trim().max(80).optional().nullable(),
  affectsOperability: z.boolean().optional().default(false),
  operabilityOnOpen: z.nativeEnum(PlatformOperabilityStatus).optional().nullable(),
  operabilityOnResolved: z.nativeEnum(PlatformOperabilityStatus).optional().nullable(),

  partsUsed: z
    .array(
      z.object({
        sparePartId: z.string().min(1),
        qty: z.coerce.number().positive(),
        unitCostCents: z.coerce.number().int().min(0).optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

type NormalizedPartUsage = {
  sparePartId: string;
  qty: number;
  unitCostCents: number | null;
  totalCostCents: number | null;
  sparePartName: string;
};

async function normalizePartsUsed(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  partsUsed: Array<{
    sparePartId: string;
    qty: number;
    unitCostCents?: number | null;
  }>
): Promise<NormalizedPartUsage[]> {
  if (partsUsed.length === 0) return [];

  const uniqueIds = Array.from(new Set(partsUsed.map((p) => p.sparePartId)));

  const parts = await tx.sparePart.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      stockQty: true,
      costPerUnitCents: true,
      isActive: true,
    },
  });

  const partMap = new Map(parts.map((p) => [p.id, p]));

  return partsUsed.map((p) => {
    const part = partMap.get(p.sparePartId);
    if (!part) throw new Error("Recambio no existe");
    if (!part.isActive) throw new Error(`Recambio inactivo: ${part.name}`);
    if (Number(part.stockQty) < p.qty) {
      throw new Error(
        `Stock insuficiente en ${part.name}. Stock actual: ${part.stockQty}, solicitado: ${p.qty}`
      );
    }

    const unitCost =
      p.unitCostCents != null
        ? Number(p.unitCostCents)
        : part.costPerUnitCents != null
          ? Number(part.costPerUnitCents)
          : null;

    const totalCost = unitCost != null ? Math.round(unitCost * p.qty) : null;

    return {
      sparePartId: p.sparePartId,
      qty: p.qty,
      unitCostCents: unitCost,
      totalCostCents: totalCost,
      sparePartName: part.name,
    };
  });
}

async function createPartConsumptions(params: {
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
  eventId: string;
  createdByUserId: string;
  note: string | null;
  partsUsed: NormalizedPartUsage[];
}) {
  const { tx, eventId, createdByUserId, note, partsUsed } = params;

  for (const p of partsUsed) {
    await tx.maintenancePartUsage.create({
      data: {
        maintenanceEventId: eventId,
        sparePartId: p.sparePartId,
        qty: p.qty,
        unitCostCents: p.unitCostCents,
        totalCostCents: p.totalCostCents,
      },
    });

    await tx.sparePartMovement.create({
      data: {
        sparePartId: p.sparePartId,
        maintenanceEventId: eventId,
        type: SparePartMovementType.CONSUMPTION,
        qty: p.qty,
        unitCostCents: p.unitCostCents,
        totalCostCents: p.totalCostCents,
        note: note?.trim()
          ? `Consumo en mantenimiento · ${note.trim()}`
          : `Consumo en mantenimiento ${eventId}`,
        createdByUserId,
      },
    });

    await tx.sparePart.update({
      where: { id: p.sparePartId },
      data: {
        stockQty: {
          decrement: p.qty,
        },
      },
    });
  }
}

export async function POST(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
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
    hoursAtService,
    note,
    applyToEntity,
    severity,
    status,
    supplierName,
    externalWorkshop,
    costCents,
    laborCostCents,
    resolvedAt,
    faultCode,
    partsUsed,
    affectsOperability,
    operabilityOnOpen,
    operabilityOnResolved,
  } = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const createdByUserId = session.userId as string;

      let effectiveHours: number;
      let jetskiId: string | null = null;
      let assetId: string | null = null;

      if (entityType === MaintenanceEntityType.JETSKI) {
        const jetski = await tx.jetski.findUnique({
          where: { id: entityId },
          select: { id: true, currentHours: true },
        });
        if (!jetski) throw new Error("Jetski no existe");

        const h =
          typeof hoursAtService === "number"
            ? hoursAtService
            : jetski.currentHours;

        if (h === null || typeof h !== "number") {
          throw new Error("hoursAtService requerido (no hay currentHours)");
        }

        effectiveHours = h;
        jetskiId = jetski.id;
      } else if (entityType === MaintenanceEntityType.ASSET) {
        const asset = await tx.asset.findUnique({
          where: { id: entityId },
          select: {
            id: true,
            currentHours: true,
          },
        });
        if (!asset) throw new Error("Asset no existe");

        const h =
          typeof hoursAtService === "number"
            ? hoursAtService
            : asset.currentHours;

        if (h === null || typeof h !== "number") {
          throw new Error("hoursAtService requerido (no hay currentHours)");
        }

        effectiveHours = h;
        assetId = asset.id;
      } else {
        throw new Error("Tipo inválido");
      }

      const normalizedPartsUsed = await normalizePartsUsed(tx, partsUsed);
      const calculatedPartsCostCents = normalizedPartsUsed.reduce(
        (acc, p) => acc + Number(p.totalCostCents ?? 0),
        0
      );

      const ev = await tx.maintenanceEvent.create({
        data: {
          entityType,
          type,
          jetskiId,
          assetId,
          hoursAtService: effectiveHours,
          note: note?.trim() || null,
          createdByUserId,
          severity,
          status,
          supplierName: supplierName?.trim() || null,
          externalWorkshop,
          costCents: costCents ?? null,
          laborCostCents: laborCostCents ?? null,
          partsCostCents: calculatedPartsCostCents,
          resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
          faultCode: faultCode?.trim() || null,
          affectsOperability,
          operabilityOnOpen: operabilityOnOpen ?? null,
          operabilityOnResolved: operabilityOnResolved ?? null,
        },
        select: {
          id: true,
          entityType: true,
          type: true,
          createdAt: true,
          hoursAtService: true,
          status: true,
        },
      });

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: ev.id,
        kind: MaintenanceEventLogKind.CREATED,
        message: `Evento creado (${type})`,
        createdByUserId,
        payloadJson: {
          entityType,
          entityId,
          type,
          status,
          severity,
          hoursAtService: effectiveHours,
          externalWorkshop,
          faultCode: faultCode?.trim() || null,
          partsUsedCount: normalizedPartsUsed.length,
          calculatedPartsCostCents,
        },
      });

      await createPartConsumptions({
        tx,
        eventId: ev.id,
        createdByUserId,
        note: note?.trim() || null,
        partsUsed: normalizedPartsUsed,
      });

        if (normalizedPartsUsed.length > 0) {
          await createMaintenanceEventLog({
            tx,
            maintenanceEventId: ev.id,
            kind: MaintenanceEventLogKind.PARTS_UPDATED,
            message: `Piezas asociadas al crear el evento: ${normalizedPartsUsed.length}`,
            createdByUserId,
            payloadJson: {
              partsUsed: normalizedPartsUsed.map((p) => ({
                sparePartId: p.sparePartId,
                qty: p.qty,
                unitCostCents: p.unitCostCents,
                totalCostCents: p.totalCostCents,
                sparePartName: p.sparePartName,
              })),
              calculatedPartsCostCents,
            },
          });
        }

      if (applyToEntity && (type === "SERVICE" || type === "OIL_CHANGE")) {
        if (jetskiId) {
          await tx.jetski.update({
            where: { id: jetskiId },
            data: { lastServiceHours: effectiveHours },
            select: { id: true },
          });
        }
        if (assetId) {
          await tx.asset.update({
            where: { id: assetId },
            data: { lastServiceHours: effectiveHours },
            select: { id: true },
          });
        }
      }

      if (applyToEntity && type === "HOUR_ADJUSTMENT") {
        if (jetskiId) {
          await tx.jetski.update({
            where: { id: jetskiId },
            data: { currentHours: effectiveHours },
            select: { id: true },
          });
        }
        if (assetId) {
          await tx.asset.update({
            where: { id: assetId },
            data: { currentHours: effectiveHours },
            select: { id: true },
          });
        }
      }

      if (affectsOperability && operabilityOnOpen) {
        if (jetskiId) {
          await tx.jetski.update({
            where: { id: jetskiId },
            data: {
              operabilityStatus: operabilityOnOpen,
            },
          });
        }

        if (assetId) {
          await tx.asset.update({
            where: { id: assetId },
            data: {
              operabilityStatus: operabilityOnOpen,
            },
          });
        }

        await createMaintenanceEventLog({
          tx,
          maintenanceEventId: ev.id,
          kind: MaintenanceEventLogKind.FIELD_UPDATE,
          message: `Operatividad actualizada al abrir evento: ${operabilityOnOpen}`,
          createdByUserId,
          payloadJson: {
            affectsOperability,
            operabilityOnOpen,
            operabilityOnResolved: operabilityOnResolved ?? null,
          },
        });
      }

      return {
        ok: true,
        event: ev,
        partsUsedCount: normalizedPartsUsed.length,
        calculatedPartsCostCents,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
