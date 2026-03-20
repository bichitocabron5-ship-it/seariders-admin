// src/app/api/admin/expenses/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { ExpenseCostCenter, ExpensePaymentMethod, ExpenseStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (/[ÃÂâ]/.test(normalized)) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Keep original value if decoding fails.
    }
  }

  return normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}

const Body = z.object({
  expenseDate: z.string().optional(),
  description: z.string().trim().min(1).max(200).optional(),

  reference: z.string().trim().max(100).optional().nullable(),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),

  categoryId: z.string().min(1).optional(),
  vendorId: z.string().optional().nullable(),

  costCenter: z.nativeEnum(ExpenseCostCenter).optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  paymentMethod: z.nativeEnum(ExpensePaymentMethod).optional().nullable(),

  amountCents: z.coerce.number().int().min(0).optional(),
  taxCents: z.coerce.number().int().min(0).optional().nullable(),
  totalCents: z.coerce.number().int().min(0).optional().nullable(),

  hasInvoice: z.boolean().optional(),
  pricesIncludeTax: z.boolean().optional(),
  taxRateBp: z.coerce.number().int().min(0).max(10000).optional().nullable(),

  paidAt: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),

  note: z.string().trim().max(2000).optional().nullable(),

  maintenanceEventId: z.string().optional().nullable(),
  sparePartId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
});

export async function PATCH(
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
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const data: Prisma.ExpenseUncheckedUpdateInput = {};

    if (b.expenseDate !== undefined) data.expenseDate = new Date(b.expenseDate);
    if (b.description !== undefined) data.description = normalizeText(b.description) ?? "";

    if (b.reference !== undefined) data.reference = normalizeText(b.reference) || null;
    if (b.invoiceNumber !== undefined) data.invoiceNumber = normalizeText(b.invoiceNumber) || null;

    if (b.categoryId !== undefined) data.categoryId = b.categoryId;
    if (b.vendorId !== undefined) data.vendorId = b.vendorId || null;

    if (b.costCenter !== undefined) data.costCenter = b.costCenter;
    if (b.status !== undefined) data.status = b.status;
    if (b.paymentMethod !== undefined) data.paymentMethod = b.paymentMethod ?? null;

    if (b.amountCents !== undefined) data.amountCents = b.amountCents;
    if (b.taxCents !== undefined) data.taxCents = b.taxCents ?? null;
    if (b.totalCents !== undefined) data.totalCents = b.totalCents ?? null;

    if (b.hasInvoice !== undefined) data.hasInvoice = b.hasInvoice;
    if (b.pricesIncludeTax !== undefined) data.pricesIncludeTax = b.pricesIncludeTax;
    if (b.taxRateBp !== undefined) data.taxRateBp = b.taxRateBp ?? null;

    if (b.paidAt !== undefined) data.paidAt = b.paidAt ? new Date(b.paidAt) : null;
    if (b.dueDate !== undefined) data.dueDate = b.dueDate ? new Date(b.dueDate) : null;

    if (b.note !== undefined) data.note = normalizeText(b.note) || null;

    if (b.maintenanceEventId !== undefined) data.maintenanceEventId = b.maintenanceEventId || null;
    if (b.sparePartId !== undefined) data.sparePartId = b.sparePartId || null;
    if (b.employeeId !== undefined) data.employeeId = b.employeeId || null;

    const row = await prisma.expense.update({
      where: { id },
      data,
      select: {
        id: true,
        expenseDate: true,
        description: true,
        status: true,
        costCenter: true,
        amountCents: true,
        taxCents: true,
        totalCents: true,
        category: { select: { id: true, name: true, code: true } },
        vendor: { select: { id: true, name: true, code: true } },
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
