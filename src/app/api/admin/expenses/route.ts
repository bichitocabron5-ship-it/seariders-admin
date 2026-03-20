// src/app/api/admin/expenses/route.ts
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
  Prisma,
} from "@prisma/client";

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

const Query = z.object({
  q: z.string().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  costCenter: z.nativeEnum(ExpenseCostCenter).optional(),
  categoryId: z.string().optional(),
  vendorId: z.string().optional(),
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(),   // YYYY-MM-DD
});

const Body = z.object({
  expenseDate: z.string().min(1),
  description: z.string().trim().min(1).max(200),

  reference: z.string().trim().max(100).optional().nullable(),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),

  categoryId: z.string().min(1),
  vendorId: z.string().optional().nullable(),

  costCenter: z.nativeEnum(ExpenseCostCenter).optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  paymentMethod: z.nativeEnum(ExpensePaymentMethod).optional().nullable(),

  amountCents: z.coerce.number().int().min(0),
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

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    costCenter: url.searchParams.get("costCenter") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    vendorId: url.searchParams.get("vendorId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { q, status, costCenter, categoryId, vendorId, from, to } = parsed.data;

  const where: Prisma.ExpenseWhereInput = {};

  if (status) where.status = status;
  if (costCenter) where.costCenter = costCenter;
  if (categoryId) where.categoryId = categoryId;
  if (vendorId) where.vendorId = vendorId;

  if (from || to) {
    where.expenseDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    };
  }

  if (q?.trim()) {
    where.OR = [
      { description: { contains: q.trim(), mode: "insensitive" } },
      { reference: { contains: q.trim(), mode: "insensitive" } },
      { invoiceNumber: { contains: q.trim(), mode: "insensitive" } },
      { note: { contains: q.trim(), mode: "insensitive" } },
      { category: { name: { contains: q.trim(), mode: "insensitive" } } },
      { vendor: { name: { contains: q.trim(), mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.expense.findMany({
    where,
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      expenseDate: true,
      description: true,
      reference: true,
      invoiceNumber: true,

      costCenter: true,
      status: true,
      paymentMethod: true,

      amountCents: true,
      taxCents: true,
      totalCents: true,

      hasInvoice: true,
      pricesIncludeTax: true,
      taxRateBp: true,

      paidAt: true,
      dueDate: true,
      note: true,

      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },

      vendorId: true,
      vendor: {
        select: {
          id: true,
          name: true,
          code: true,
          taxId: true,
        },
      },

      maintenanceEventId: true,
      sparePartId: true,
      employeeId: true,

      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });

  const summary = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.amountCents += Number(r.amountCents ?? 0);
      acc.taxCents += Number(r.taxCents ?? 0);
      acc.totalCents += Number(r.totalCents ?? r.amountCents ?? 0);

      if (r.status === "PAID") {
        acc.paidCents += Number(r.totalCents ?? r.amountCents ?? 0);
      }
      if (r.status === "PENDING") {
        acc.pendingCents += Number(r.totalCents ?? r.amountCents ?? 0);
      }

      return acc;
    },
    {
      count: 0,
      amountCents: 0,
      taxCents: 0,
      totalCents: 0,
      paidCents: 0,
      pendingCents: 0,
    }
  );

  return NextResponse.json({ ok: true, rows, summary });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
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
    const row = await prisma.expense.create({
      data: {
        expenseDate: new Date(b.expenseDate),
        description: normalizeText(b.description) ?? "",

        reference: normalizeText(b.reference) || null,
        invoiceNumber: normalizeText(b.invoiceNumber) || null,

        categoryId: b.categoryId,
        vendorId: b.vendorId || null,

        costCenter: b.costCenter ?? "GENERAL",
        status: b.status ?? "DRAFT",
        paymentMethod: b.paymentMethod ?? null,

        amountCents: b.amountCents,
        taxCents: b.taxCents ?? null,
        totalCents: b.totalCents ?? b.amountCents,

        hasInvoice: b.hasInvoice ?? false,
        pricesIncludeTax: b.pricesIncludeTax ?? true,
        taxRateBp: b.taxRateBp ?? null,

        paidAt: b.paidAt ? new Date(b.paidAt) : null,
        dueDate: b.dueDate ? new Date(b.dueDate) : null,

        note: normalizeText(b.note) || null,

        maintenanceEventId: b.maintenanceEventId || null,
        sparePartId: b.sparePartId || null,
        employeeId: b.employeeId || null,

        createdByUserId: session.userId,
      },
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
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
