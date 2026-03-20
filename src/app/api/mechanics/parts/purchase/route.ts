// src/app/api/mechanics/parts/purchase/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import {
  ExpenseCostCenter,
  ExpensePaymentMethod,
  ExpenseStatus,
  SparePartMovementType,
} from "@prisma/client";

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

  unitCostCents: z.coerce.number().int().min(0),
  totalCostCents: z.coerce.number().int().min(0).optional().nullable(),

  vendorId: z.string().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),

  createExpense: z.boolean().optional(),
  expenseDate: z.string().optional(),
  expenseStatus: z.nativeEnum(ExpenseStatus).optional(),
  paymentMethod: z.nativeEnum(ExpensePaymentMethod).optional().nullable(),

  hasInvoice: z.boolean().optional(),
  pricesIncludeTax: z.boolean().optional(),
  taxRateBp: z.coerce.number().int().min(0).max(10000).optional().nullable(),

  maintenanceEventId: z.string().optional().nullable(),
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
        },
      });

      if (!sparePart) {
        throw new Error("El recambio no existe.");
      }

      if (b.vendorId) {
        const vendor = await tx.expenseVendor.findUnique({
          where: { id: b.vendorId },
          select: { id: true, isActive: true },
        });
        if (!vendor) throw new Error("El proveedor no existe.");
        if (!vendor.isActive) throw new Error("El proveedor está inactivo.");
      }

      if (b.maintenanceEventId) {
        const ev = await tx.maintenanceEvent.findUnique({
          where: { id: b.maintenanceEventId },
          select: { id: true },
        });
        if (!ev) throw new Error("El evento de mantenimiento no existe.");
      }

      const computedTotalCostCents =
        b.totalCostCents != null ? b.totalCostCents : Math.round(b.qty * b.unitCostCents);

      if (computedTotalCostCents < 0) {
        throw new Error("El coste total no puede ser negativo.");
      }

      const hasInvoice = b.hasInvoice ?? false;
      const pricesIncludeTax = b.pricesIncludeTax ?? true;
      const taxRateBp = hasInvoice ? Number(b.taxRateBp ?? 0) : 0;

      let amountCents = computedTotalCostCents;
      let taxCents = 0;
      let totalCents = computedTotalCostCents;

      if (hasInvoice && taxRateBp > 0) {
        if (pricesIncludeTax) {
          const base = Math.round(computedTotalCostCents / (1 + taxRateBp / 10000));
          const tax = computedTotalCostCents - base;
          amountCents = base;
          taxCents = tax;
          totalCents = computedTotalCostCents;
        } else {
          const tax = Math.round(computedTotalCostCents * taxRateBp / 10000);
          amountCents = computedTotalCostCents;
          taxCents = tax;
          totalCents = computedTotalCostCents + tax;
        }
      }

      let expenseId: string | null = null;

        const sparePartsCategory = await tx.expenseCategory.findUnique({
          where: { code: "SPARE_PARTS" },
          select: { id: true },
        });

        if (!sparePartsCategory) {
          throw new Error('No existe la categoría de gasto "SPARE_PARTS".');
        }
      
      if (b.createExpense ?? true) {
        
        const expense = await tx.expense.create({
          data: {
            expenseDate: b.expenseDate ? new Date(b.expenseDate) : new Date(),
            description: `Compra recambio: ${sparePart.name}`,
            reference: null,
            invoiceNumber: null,

            categoryId: sparePartsCategory.id,

            costCenter: ExpenseCostCenter.MECHANICS,

            status: b.expenseStatus ?? ExpenseStatus.PAID,
            paymentMethod: b.paymentMethod ?? null,

            amountCents,
            taxCents,
            totalCents,

            hasInvoice,
            pricesIncludeTax,
            taxRateBp,

            paidAt:
            (b.expenseStatus ?? ExpenseStatus.PAID) === ExpenseStatus.PAID
                ? (b.expenseDate ? new Date(b.expenseDate) : new Date())
                : null,

            dueDate: null,
            note: b.note?.trim() || null,

            ...(b.vendorId ? { vendorId: b.vendorId } : {}),
            ...(b.maintenanceEventId ? { maintenanceEventId: b.maintenanceEventId } : {}),

            sparePartId: b.sparePartId,
            createdByUserId: session.userId,
          },
          select: { id: true },
        });

        expenseId = expense.id;
      }

      const updatedPart = await tx.sparePart.update({
        where: { id: b.sparePartId },
        data: {
          stockQty: {
            increment: b.qty,
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
          type: SparePartMovementType.PURCHASE,
          qty: b.qty,
          unitCostCents: b.unitCostCents,
          totalCostCents: computedTotalCostCents,
          note: b.note?.trim() || null,
          vendorId: b.vendorId || null,
          expenseId,
          maintenanceEventId: b.maintenanceEventId || null,
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
            },
          },
        },
      });

      return {
        sparePart: updatedPart,
        movement,
        expenseId,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
