// src/app/api/mechanics/events/[id]/parts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SparePartMovementType, MaintenanceEventLogKind } from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";
import { createMaintenanceEventLog } from "@/lib/mechanics-event-log";

export const runtime = "nodejs";

const Body = z.object({
  partsUsed: z.array(
    z.object({
      sparePartId: z.string().min(1),
      qty: z.coerce.number().positive(),
      unitCostCents: z.coerce.number().int().min(0).optional().nullable(),
    })
  ),
});

type DesiredPart = {
  sparePartId: string;
  qty: number;
  unitCostCents: number | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireMechanicsOrAdmin();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const out = await prisma.$transaction(async (tx) => {
      const event = await tx.maintenanceEvent.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          note: true,
          status: true,
          partUsages: {
            select: {
              id: true,
              sparePartId: true,
              qty: true,
              unitCostCents: true,
              totalCostCents: true,
            },
          },
          sparePartMovements: {
            where: {
              type: SparePartMovementType.CONSUMPTION,
            },
            select: {
              id: true,
              sparePartId: true,
              qty: true,
              unitCostCents: true,
              totalCostCents: true,
            },
          },
        },
      });

      if (!event) {
        throw new Error("Evento no encontrado");
      }

      const desiredRaw = parsed.data.partsUsed;

      // Normalizar por sparePartId por si llega duplicado desde UI
      const desiredMap = new Map<string, DesiredPart>();
      for (const p of desiredRaw) {
        const existing = desiredMap.get(p.sparePartId);
        if (existing) {
          existing.qty += p.qty;
          if (p.unitCostCents != null) {
            existing.unitCostCents = p.unitCostCents;
          }
        } else {
          desiredMap.set(p.sparePartId, {
            sparePartId: p.sparePartId,
            qty: p.qty,
            unitCostCents: p.unitCostCents ?? null,
          });
        }
      }

      const desired = Array.from(desiredMap.values());

      const sparePartIds = Array.from(
        new Set([
          ...desired.map((p) => p.sparePartId),
          ...event.partUsages.map((p) => p.sparePartId),
        ])
      );

      const spareParts = await tx.sparePart.findMany({
        where: { id: { in: sparePartIds } },
        select: {
          id: true,
          name: true,
          stockQty: true,
          costPerUnitCents: true,
          isActive: true,
        },
      });

      const sparePartMap = new Map(spareParts.map((p) => [p.id, p]));

      for (const id of sparePartIds) {
        if (!sparePartMap.has(id)) {
          throw new Error(`Recambio no encontrado: ${id}`);
        }
      }

      // Estado actual agregado por sparePartId
      const currentMap = new Map<
        string,
        { qty: number; unitCostCents: number | null }
      >();

      for (const p of event.partUsages) {
        const existing = currentMap.get(p.sparePartId);
        if (existing) {
          existing.qty += Number(p.qty ?? 0);
          if (p.unitCostCents != null) {
            existing.unitCostCents = Number(p.unitCostCents);
          }
        } else {
          currentMap.set(p.sparePartId, {
            qty: Number(p.qty ?? 0),
            unitCostCents:
              p.unitCostCents != null ? Number(p.unitCostCents) : null,
          });
        }
      }

      // Validar stock por diferencia
      for (const p of desired) {
        const part = sparePartMap.get(p.sparePartId)!;
        if (!part.isActive) {
          throw new Error(`Recambio inactivo: ${part.name}`);
        }

        const currentQty = currentMap.get(p.sparePartId)?.qty ?? 0;
        const delta = p.qty - currentQty;

        if (delta > 0 && Number(part.stockQty) < delta) {
          throw new Error(
            `Stock insuficiente para ${part.name}. Stock actual: ${part.stockQty}, incremento solicitado: ${delta}`
          );
        }
      }

      // Borrar consumos actuales del evento
      await tx.maintenancePartUsage.deleteMany({
        where: { maintenanceEventId: event.id },
      });

      await tx.sparePartMovement.deleteMany({
        where: {
          maintenanceEventId: event.id,
          type: SparePartMovementType.CONSUMPTION,
        },
      });

      // Revertir stock anterior
      for (const p of event.partUsages) {
        await tx.sparePart.update({
          where: { id: p.sparePartId },
          data: {
            stockQty: {
              increment: Number(p.qty ?? 0),
            },
          },
        });
      }

      // Crear nuevo estado de piezas y volver a descontar stock
      let calculatedPartsCostCents = 0;

      for (const p of desired) {
        const part = sparePartMap.get(p.sparePartId)!;

        const unitCost =
          p.unitCostCents != null
            ? Number(p.unitCostCents)
            : part.costPerUnitCents != null
              ? Number(part.costPerUnitCents)
              : null;

        const totalCostCents =
          unitCost != null ? Math.round(unitCost * p.qty) : null;

        calculatedPartsCostCents += Number(totalCostCents ?? 0);

        await tx.maintenancePartUsage.create({
          data: {
            maintenanceEventId: event.id,
            sparePartId: p.sparePartId,
            qty: p.qty,
            unitCostCents: unitCost,
            totalCostCents,
          },
        });

        await tx.sparePartMovement.create({
          data: {
            maintenanceEventId: event.id,
            sparePartId: p.sparePartId,
            type: SparePartMovementType.CONSUMPTION,
            qty: p.qty,
            unitCostCents: unitCost,
            totalCostCents,
            note: event.note?.trim()
              ? `Consumo en mantenimiento · ${event.note.trim()}`
              : `Consumo en mantenimiento ${event.id}`,
            createdByUserId: session.userId,
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

      const updatedEvent = await tx.maintenanceEvent.update({
        where: { id: event.id },
        data: {
          partsCostCents: calculatedPartsCostCents,
        },
        select: {
          id: true,
          partsCostCents: true,
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
        },
      });

      await createMaintenanceEventLog({
        tx,
        maintenanceEventId: event.id,
        kind: MaintenanceEventLogKind.PARTS_UPDATED,
        message: "Piezas del evento actualizadas",
        createdByUserId: session.userId,
        payloadJson: {
          previousParts: event.partUsages.map((p) => ({
            sparePartId: p.sparePartId,
            qty: p.qty,
            unitCostCents: p.unitCostCents,
            totalCostCents: p.totalCostCents,
          })),
          nextParts: desired.map((p) => ({
            sparePartId: p.sparePartId,
            qty: p.qty,
            unitCostCents: p.unitCostCents,
          })),
          calculatedPartsCostCents,
        },
      });

      return {
        ok: true,
        row: updatedEvent,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}


