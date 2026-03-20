// src/app/api/mechanics/parts/[id]/detail/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

function isInboundMovement(type: string) {
  return (
    type === "PURCHASE" ||
    type === "ADJUSTMENT_IN" ||
    type === "INITIAL_STOCK" ||
    type === "RETURN"
  );
}

function isOutboundMovement(type: string) {
  return type === "CONSUMPTION" || type === "ADJUSTMENT_OUT";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const part = await prisma.sparePart.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      brand: true,
      model: true,
      unit: true,
      stockQty: true,
      minStockQty: true,
      costPerUnitCents: true,
      supplierName: true,
      note: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,

      movements: {
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          type: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          note: true,
          createdAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          expense: {
            select: {
              id: true,
              status: true,
              totalCents: true,
              expenseDate: true,
            },
          },
          maintenanceEvent: {
            select: {
              id: true,
              entityType: true,
              type: true,
              faultCode: true,
              createdAt: true,
              jetski: {
                select: {
                  id: true,
                  number: true,
                },
              },
              asset: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
        },
      },

      maintenanceUsages: {
        orderBy: [{ createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          maintenanceEvent: {
            select: {
              id: true,
              entityType: true,
              type: true,
              faultCode: true,
              createdAt: true,
              jetski: {
                select: {
                  id: true,
                  number: true,
                },
              },
              asset: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!part) {
    return NextResponse.json(
      { error: "Recambio no encontrado" },
      { status: 404 }
    );
  }

  const lowStock = Number(part.stockQty) <= Number(part.minStockQty);

  const summary = part.movements.reduce(
    (acc, m) => {
      const qty = Number(m.qty ?? 0);

      if (isInboundMovement(m.type)) acc.totalIn += qty;
      if (isOutboundMovement(m.type)) acc.totalOut += qty;

      acc.movementsCount += 1;
      acc.totalMovementCostCents += Number(m.totalCostCents ?? 0);

      return acc;
    },
    {
      totalIn: 0,
      totalOut: 0,
      movementsCount: 0,
      totalMovementCostCents: 0,
    }
  );

  const maintenanceUsageSummary = part.maintenanceUsages.reduce(
    (acc, u) => {
      acc.totalQty += Number(u.qty ?? 0);
      acc.totalCostCents += Number(u.totalCostCents ?? 0);
      acc.count += 1;
      return acc;
    },
    {
      totalQty: 0,
      totalCostCents: 0,
      count: 0,
    }
  );

  return NextResponse.json({
    ok: true,
    row: part,
    lowStock,
    summary,
    maintenanceUsageSummary,
  });
}
