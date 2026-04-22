// src/app/api/mechanics/events/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  MaintenanceSeverity,
  MaintenanceStatus,
  MaintenanceEventLogKind,
  PlatformOperabilityStatus,
} from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";
import { createMaintenanceEventLog } from "@/lib/mechanics-event-log";
import { formatFaultCodes } from "@/lib/mechanics-fault-codes";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PatchBody = z.object({
  note: z.string().max(1000).optional().nullable(),
  severity: z.nativeEnum(MaintenanceSeverity).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  supplierName: z.string().trim().max(120).optional().nullable(),
  externalWorkshop: z.boolean().optional(),
  costCents: z.coerce.number().int().min(0).optional().nullable(),
  laborCostCents: z.coerce.number().int().min(0).optional().nullable(),
  partsCostCents: z.coerce.number().int().min(0).optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  faultCode: z.string().trim().max(300).optional().nullable(),
  affectsOperability: z.boolean().optional(),
  operabilityOnOpen: z.nativeEnum(PlatformOperabilityStatus).optional().nullable(),
  operabilityOnResolved: z.nativeEnum(PlatformOperabilityStatus).optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const row = await prisma.maintenanceEvent.findUnique({
    where: { id },
    select: {
      id: true,
      entityType: true,
      type: true,
      status: true,
      severity: true,
      createdAt: true,
      resolvedAt: true,
      hoursAtService: true,
      note: true,
      supplierName: true,
      externalWorkshop: true,
      costCents: true,
      laborCostCents: true,
      partsCostCents: true,
      faultCode: true,
      reopenCount: true,
      jetskiId: true,
      assetId: true,
      affectsOperability: true,
      operabilityOnOpen: true,
      operabilityOnResolved: true,
      jetski: {
        select: {
          id: true,
          number: true,
          model: true,
          plate: true,
          chassisNumber: true,
          maxPax: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          plate: true,
          chassisNumber: true,
          maxPax: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
        },
      },
      partUsages: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          sparePart: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      },
      logs: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          kind: true,
          message: true,
          payloadJson: true,
          createdAt: true,
          createdByUser: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
            },
          },
        },
      },
      sparePartMovements: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          sparePartId: true,
          type: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          note: true,
          sparePart: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      },
    },
  });

  if (!row) {
    return new NextResponse("Evento no encontrado", { status: 404 });
  }

  return NextResponse.json({ ok: true, row });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const current = await prisma.maintenanceEvent.findUnique({
      where: { id },
      select: {
        id: true,
        entityType: true,
        jetskiId: true,
        assetId: true,

        status: true,
        severity: true,
        note: true,
        supplierName: true,
        externalWorkshop: true,
        costCents: true,
        laborCostCents: true,
        partsCostCents: true,
        resolvedAt: true,
        faultCode: true,
        reopenCount: true,

        affectsOperability: true,
        operabilityOnOpen: true,
        operabilityOnResolved: true,
        incident: {
          select: {
            id: true,
            isOpen: true,
            status: true,
          },
        },
      },
    });

    if (!current) {
      return new NextResponse("Evento no encontrado", { status: 404 });
    }

    const nextStatus = b.status ?? current.status;

    let nextResolvedAt =
      b.resolvedAt !== undefined
        ? b.resolvedAt
          ? new Date(b.resolvedAt)
          : null
        : undefined;

    // Si se resuelve y no viene fecha, poner ahora
    if (nextStatus === "RESOLVED" && nextResolvedAt === undefined) {
      nextResolvedAt = new Date();
    }

    // Si se reabre, limpiar fecha de resolución
    if (nextStatus === "OPEN" || nextStatus === "IN_PROGRESS" || nextStatus === "EXTERNAL") {
      nextResolvedAt = null;
    }

    let nextNote =
      b.note !== undefined ? (b.note?.trim() || null) : current.note;

    const isReopening =
    current.status === "RESOLVED" &&
    (nextStatus === "OPEN" || nextStatus === "IN_PROGRESS" || nextStatus === "EXTERNAL");

  if (isReopening) {
    const stamp = new Date().toLocaleString("es-ES");
    const reopenLine = `[REABIERTO ${stamp}] Evento reabierto tras reaparecer o no quedar resuelto.`;
    nextNote = nextNote ? `${reopenLine}\n${nextNote}` : reopenLine;
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.maintenanceEvent.update({
      where: { id },
      data: {
        ...(b.severity !== undefined ? { severity: b.severity } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.supplierName !== undefined
          ? { supplierName: b.supplierName?.trim() || null }
          : {}),
        ...(b.externalWorkshop !== undefined
          ? { externalWorkshop: b.externalWorkshop }
          : {}),
        ...(b.costCents !== undefined ? { costCents: b.costCents } : {}),
        ...(b.laborCostCents !== undefined
          ? { laborCostCents: b.laborCostCents }
          : {}),
        ...(b.partsCostCents !== undefined
          ? { partsCostCents: b.partsCostCents }
          : {}),
        ...(b.faultCode !== undefined
          ? { faultCode: formatFaultCodes([b.faultCode ?? ""]) }
          : {}),
        ...(b.affectsOperability !== undefined
          ? { affectsOperability: b.affectsOperability }
          : {}),
        ...(b.operabilityOnOpen !== undefined
          ? { operabilityOnOpen: b.operabilityOnOpen }
          : {}),
        ...(b.operabilityOnResolved !== undefined
          ? { operabilityOnResolved: b.operabilityOnResolved }
          : {}),
        note: nextNote,
        resolvedAt: nextResolvedAt,
        ...(isReopening
          ? {
              reopenCount: {
                increment: 1,
              },
            }
          : {}),
      },
      select: {
        id: true,
        entityType: true,
        type: true,
        status: true,
        severity: true,
        createdAt: true,
        resolvedAt: true,
        hoursAtService: true,
        note: true,
        supplierName: true,
        externalWorkshop: true,
        costCents: true,
        laborCostCents: true,
        partsCostCents: true,
        faultCode: true,
        reopenCount: true,
        affectsOperability: true,
        operabilityOnOpen: true,
        operabilityOnResolved: true,
      },
    });

    const changedFields: Record<
      string,
      { before: Prisma.InputJsonValue | null; after: Prisma.InputJsonValue | null }
    > = {};

    if (current.status !== updated.status) {
      changedFields.status = { before: current.status, after: updated.status };
    }
    if (current.severity !== updated.severity) {
      changedFields.severity = { before: current.severity, after: updated.severity };
    }
    if ((current.note ?? null) !== (updated.note ?? null)) {
      changedFields.note = { before: current.note ?? null, after: updated.note ?? null };
    }
    if ((current.supplierName ?? null) !== (updated.supplierName ?? null)) {
      changedFields.supplierName = {
        before: current.supplierName ?? null,
        after: updated.supplierName ?? null,
      };
    }
    if (Boolean(current.externalWorkshop) !== Boolean(updated.externalWorkshop)) {
      changedFields.externalWorkshop = {
        before: current.externalWorkshop,
        after: updated.externalWorkshop,
      };
    }
    if ((current.costCents ?? null) !== (updated.costCents ?? null)) {
      changedFields.costCents = { before: current.costCents ?? null, after: updated.costCents ?? null };
    }
    if ((current.laborCostCents ?? null) !== (updated.laborCostCents ?? null)) {
      changedFields.laborCostCents = {
        before: current.laborCostCents ?? null,
        after: updated.laborCostCents ?? null,
      };
    }
    if ((current.partsCostCents ?? null) !== (updated.partsCostCents ?? null)) {
      changedFields.partsCostCents = {
        before: current.partsCostCents ?? null,
        after: updated.partsCostCents ?? null,
      };
    }
    if ((current.faultCode ?? null) !== (updated.faultCode ?? null)) {
      changedFields.faultCode = {
        before: current.faultCode ?? null,
        after: updated.faultCode ?? null,
      };
    }
    const currentResolvedAt =
      current.resolvedAt instanceof Date
        ? current.resolvedAt.toISOString()
        : current.resolvedAt ?? null;

    const updatedResolvedAt =
      updated.resolvedAt instanceof Date
        ? updated.resolvedAt.toISOString()
        : updated.resolvedAt ?? null;

    if (currentResolvedAt !== updatedResolvedAt) {
      changedFields.resolvedAt = {
        before: currentResolvedAt,
        after: updatedResolvedAt,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.FIELD_UPDATE,
        message: "Evento actualizado",
        createdByUserId: session.userId,
        payloadJson: changedFields,
      });
    }

    if (current.status !== updated.status) {
      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind:
          updated.status === "RESOLVED"
            ? MaintenanceEventLogKind.RESOLVED
            : isReopening
              ? MaintenanceEventLogKind.REOPENED
              : MaintenanceEventLogKind.STATUS_CHANGED,
        message: isReopening
          ? `Evento reabierto (${current.status} → ${updated.status})`
          : `Estado cambiado (${current.status} → ${updated.status})`,
        createdByUserId: session.userId,
        payloadJson: {
          beforeStatus: current.status,
          afterStatus: updated.status,
          reopenCountBefore: current.reopenCount,
          reopenCountAfter: updated.reopenCount,
        },
      });
    }

    if ((current.partsCostCents ?? null) !== (updated.partsCostCents ?? null)) {
      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.COSTS_UPDATED,
        message: "Costes del evento actualizados",
        createdByUserId: session.userId,
        payloadJson: {
          costCents: {
            before: current.costCents ?? null,
            after: updated.costCents ?? null,
          },
          laborCostCents: {
            before: current.laborCostCents ?? null,
            after: updated.laborCostCents ?? null,
          },
          partsCostCents: {
            before: current.partsCostCents ?? null,
            after: updated.partsCostCents ?? null,
          },
        },
      });
    }
    
    const nextAffectsOperability =
      b.affectsOperability !== undefined
        ? b.affectsOperability
        : current.affectsOperability;

    const nextOperabilityOnOpen =
      b.operabilityOnOpen !== undefined
        ? b.operabilityOnOpen
        : current.operabilityOnOpen;

    const nextOperabilityOnResolved =
      b.operabilityOnResolved !== undefined
        ? b.operabilityOnResolved
        : current.operabilityOnResolved;

    const isActiveStatus =
      nextStatus === "OPEN" ||
      nextStatus === "IN_PROGRESS" ||
      nextStatus === "EXTERNAL";

    if (
      !isReopening &&
      nextAffectsOperability &&
      isActiveStatus &&
      nextOperabilityOnOpen
    ) {
      if (current.entityType === "JETSKI" && current.jetskiId) {
        await tx.jetski.update({
          where: { id: current.jetskiId },
          data: {
            operabilityStatus: nextOperabilityOnOpen,
          },
        });
      }

      if (current.entityType === "ASSET" && current.assetId) {
        await tx.asset.update({
          where: { id: current.assetId },
          data: {
            operabilityStatus: nextOperabilityOnOpen,
          },
        });
      }

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.FIELD_UPDATE,
        message: `Operatividad actualizada en evento activo: ${nextOperabilityOnOpen}`,
        createdByUserId: session.userId,
        payloadJson: {
          affectsOperability: nextAffectsOperability,
          operabilityOnOpen: nextOperabilityOnOpen,
          status: nextStatus,
        },
      });
    }

    // Si se resuelve, restaurar estado operativo si procede
    if (
      nextAffectsOperability &&
      updated.status === "RESOLVED" &&
      nextOperabilityOnResolved
    ) {
      if (current.entityType === "JETSKI" && current.jetskiId) {
        await tx.jetski.update({
          where: { id: current.jetskiId },
          data: {
            operabilityStatus: nextOperabilityOnResolved,
          },
        });
      }

      if (current.entityType === "ASSET" && current.assetId) {
        await tx.asset.update({
          where: { id: current.assetId },
          data: {
            operabilityStatus: nextOperabilityOnResolved,
          },
        });
      }

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.FIELD_UPDATE,
        message: `Operatividad actualizada al resolver evento: ${nextOperabilityOnResolved}`,
        createdByUserId: session.userId,
        payloadJson: {
          operabilityOnResolved: nextOperabilityOnResolved,
        },
      });
    }

    // Si se reabre, volver a aplicar operatividad de apertura
    if (isReopening && nextAffectsOperability && nextOperabilityOnOpen) {
      if (current.entityType === "JETSKI" && current.jetskiId) {
        await tx.jetski.update({
          where: { id: current.jetskiId },
          data: {
            operabilityStatus: nextOperabilityOnOpen,
          },
        });
      }

      if (current.entityType === "ASSET" && current.assetId) {
        await tx.asset.update({
          where: { id: current.assetId },
          data: {
            operabilityStatus: nextOperabilityOnOpen,
          },
        });
      }

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.REOPENED,
        message: `Operatividad reaplicada al reabrir evento: ${nextOperabilityOnOpen}`,
        createdByUserId: session.userId,
        payloadJson: {
          operabilityOnOpen: nextOperabilityOnOpen,
        },
      });
    }

    if (updated.status === "RESOLVED" && current.incident?.id) {
      await tx.incident.update({
        where: { id: current.incident.id },
        data: {
          isOpen: false,
          status: "RESOLVED",
          closedAt: updated.resolvedAt ?? new Date(),
        },
      });

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.FIELD_UPDATE,
        message: "Incidencia de Plataforma vinculada cerrada automáticamente",
        createdByUserId: session.userId,
        payloadJson: {
          incidentId: current.incident.id,
          incidentClosed: true,
        },
      });
    }

    if (isReopening && current.incident?.id) {
      await tx.incident.update({
        where: { id: current.incident.id },
        data: {
          isOpen: true,
          status: "LINKED",
          closedAt: null,
        },
      });

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: updated.id,
        kind: MaintenanceEventLogKind.REOPENED,
        message: "Incidencia de Plataforma vinculada reabierta automáticamente",
        createdByUserId: session.userId,
        payloadJson: {
          incidentId: current.incident.id,
          incidentReopened: true,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
