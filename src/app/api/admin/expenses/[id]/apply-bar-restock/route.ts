// src/app/api/admin/expenses/[id]/apply-bar-restock/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role !== "ADMIN") return null;
  return session;
}

const Body = z.object({
  note: z.string().max(1000).optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().positive(),
      unitCostCents: z.number().int().nonnegative().optional().nullable(),
    })
  ).min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id },
        select: {
          id: true,
          description: true,
          costCenter: true,
          status: true,
          vendorId: true,
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          barRestock: {
            select: { id: true },
          },
        },
      });

      if (!expense) throw new Error("Gasto no encontrado.");
      if (expense.barRestock) {
        throw new Error("Este gasto ya fue aplicado a stock Bar.");
      }

      if (!["BAR", "OPERATIONS"].includes(String(expense.costCenter))) {
        throw new Error("El gasto no pertenece a un centro compatible con reposición Bar.");
      }

      const restock = await tx.expenseBarRestock.create({
        data: {
          expenseId: expense.id,
          appliedByUserId: session.userId,
          note: parsed.data.note?.trim() || null,
        },
        select: {
          id: true,
          expenseId: true,
        },
      });

      for (const item of parsed.data.items) {
        const product = await tx.barProduct.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error("Producto Bar no encontrado.");
        }

        const qty = Number(item.quantity);
        const unitCostCents = item.unitCostCents ?? null;
        const totalCostCents =
          unitCostCents != null ? Math.round(qty * unitCostCents) : null;

        const stockBefore = Number(product.currentStock ?? 0);
        const stockAfter = stockBefore + qty;

        await tx.expenseBarRestockItem.create({
          data: {
            restockId: restock.id,
            productId: product.id,
            quantity: qty,
            unitCostCents,
            totalCostCents,
          },
        });

        await tx.barProduct.update({
          where: { id: product.id },
          data: {
            currentStock: stockAfter,
          },
        });

        await tx.barStockMovement.create({
          data: {
            productId: product.id,
            type: "IN",
            reason: "PURCHASE",
            quantity: qty,
            stockBefore,
            stockAfter,
            unitCostCents,
            notes: `Reposición desde gasto ${expense.id} · ${expense.description}`,
            sourceType: "EXPENSE",
            sourceId: expense.id,
            userId: session.userId,
          },
        });
      }

      const full = await tx.expenseBarRestock.findUnique({
        where: { id: restock.id },
        select: {
          id: true,
          expenseId: true,
          appliedAt: true,
          note: true,
          items: {
            select: {
              id: true,
              quantity: true,
              unitCostCents: true,
              totalCostCents: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  unitLabel: true,
                },
              },
            },
          },
        },
      });

      return full;
    });

    return NextResponse.json({ ok: true, row: result });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}