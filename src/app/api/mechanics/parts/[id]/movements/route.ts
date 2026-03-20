// src/app/api/mechanics/parts/[id]/movements/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireMechanicHrAdmin();
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
    },
  });

  if (!part) {
    return NextResponse.json({ error: "Recambio no encontrado" }, { status: 404 });
  }

  const movements = await prisma.sparePartMovement.findMany({
    where: { sparePartId: id },
    orderBy: [{ createdAt: "desc" }],
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
          amountCents: true,
          taxCents: true,
          totalCents: true,
          expenseDate: true,
        },
      },

      maintenanceEvent: {
        select: {
          id: true,
          entityType: true,
          jetskiId: true,
          assetId: true,
          type: true,
          status: true,
          severity: true,
          createdAt: true,
        },
      },

      createdByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    },
  });

  const summary = movements.reduce(
    (acc, m) => {
      acc.count += 1;

      if (m.type === "PURCHASE" || m.type === "ADJUSTMENT_IN" || m.type === "INITIAL_STOCK" || m.type === "RETURN") {
        acc.inQty += Number(m.qty ?? 0);
      }

      if (m.type === "CONSUMPTION" || m.type === "ADJUSTMENT_OUT") {
        acc.outQty += Number(m.qty ?? 0);
      }

      acc.totalCostCents += Number(m.totalCostCents ?? 0);
      return acc;
    },
    {
      count: 0,
      inQty: 0,
      outQty: 0,
      totalCostCents: 0,
    }
  );

  return NextResponse.json({
    ok: true,
    part,
    summary,
    movements,
  });
}