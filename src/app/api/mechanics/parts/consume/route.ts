// src/app/api/mechanics/parts/consume/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { MaintenanceStatus, SparePartMovementType } from "@prisma/client";

export const runtime = "nodejs";

async function requireMechanicHrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (["ADMIN", "MECHANIC", "HR"].includes(session.role as string)) return session;
  return null;
}

const Body = z.object({
  sparePartId: z.string().min(1),
  qty: z.coerce.number().positive(),

  maintenanceEventId: z.string().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),

  // opcional: si quieres imputar coste al evento aunque no exista unitCost en la pieza
  unitCostCentsOverride: z.coerce.number().int().min(0).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireMechanicHrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sparePart = await tx.sparePart.findUnique({
        where: { id: b.sparePartId },
        select: {
          id: true,
          name: true,
          stockQty: true,
          costPerUnitCents: true,
          minStockQty: true,
        },
      });

      if (!sparePart) {
        throw new Error("El recambio no existe.");
      }

      if (sparePart.stockQty < b.qty) {
        throw new Error(
          `Stock insuficiente. Disponible: ${sparePart.stockQty}, solicitado: ${b.qty}.`
        );
      }

      let maintenanceEvent:
        | {
            id: string;
            status: MaintenanceStatus;
            costCents: number | null;
            partsCostCents: number | null;
          }
        | null = null;

      if (b.maintenanceEventId) {
        maintenanceEvent = await tx.maintenanceEvent.findUnique({
          where: { id: b.maintenanceEventId },
          select: {
            id: true,
            status: true,
            costCents: true,
            partsCostCents: true,
          },
        });

        if (!maintenanceEvent) {
          throw new Error("El evento de mantenimiento no existe.");
        }

        if (
          maintenanceEvent.status === MaintenanceStatus.RESOLVED ||
          maintenanceEvent.status === MaintenanceStatus.CANCELED
        ) {
          throw new Error("No puedes consumir recambios en un evento cerrado.");
        }
      }

      const unitCostCents =
        b.unitCostCentsOverride != null
          ? b.unitCostCentsOverride
          : Number(sparePart.costPerUnitCents ?? 0);

      const totalCostCents = Math.round(unitCostCents * b.qty);

      const updatedPart = await tx.sparePart.update({
        where: { id: b.sparePartId },
        data: {
          stockQty: {
            decrement: b.qty,
          },
        },
        select: {
          id: true,
          name: true,
          stockQty: true,
          minStockQty: true,
          costPerUnitCents: true,
        },
      });

      const movement = await tx.sparePartMovement.create({
        data: {
          sparePartId: b.sparePartId,
          type: SparePartMovementType.CONSUMPTION,
          qty: b.qty,
          unitCostCents,
          totalCostCents,
          note: b.note?.trim() || null,
          ...(b.maintenanceEventId ? { maintenanceEventId: b.maintenanceEventId } : {}),
          createdByUserId: session.userId,
        },
        select: {
          id: true,
          type: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          note: true,
          createdAt: true,
          maintenanceEvent: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      let updatedMaintenanceEvent: {
        id: string;
        costCents: number | null;
        partsCostCents: number | null;
      } | null = null;

      if (b.maintenanceEventId) {
        updatedMaintenanceEvent = await tx.maintenanceEvent.update({
          where: { id: b.maintenanceEventId },
          data: {
            partsCostCents: {
              increment: totalCostCents,
            },
            costCents: {
              increment: totalCostCents,
            },
          },
          select: {
            id: true,
            costCents: true,
            partsCostCents: true,
          },
        });
      }

      const lowStock =
        updatedPart.minStockQty != null &&
        updatedPart.minStockQty > 0 &&
        updatedPart.stockQty <= updatedPart.minStockQty;

      return {
        sparePart: updatedPart,
        movement,
        maintenanceEvent: updatedMaintenanceEvent,
        stockAlert: lowStock
          ? `Stock bajo en ${updatedPart.name}: ${updatedPart.stockQty}`
          : null,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
