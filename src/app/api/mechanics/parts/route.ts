// src/app/api/mechanics/parts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Query = z.object({
  q: z.string().optional(),
  only: z.enum(["low_stock"]).optional(),
});

export async function GET(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    only: url.searchParams.get("only") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query invalida", { status: 400 });

  const { q, only } = parsed.data;

  const where: Prisma.SparePartWhereInput = { isActive: true };

  if (q?.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: "insensitive" } },
      { sku: { contains: q.trim(), mode: "insensitive" } },
      { category: { contains: q.trim(), mode: "insensitive" } },
      { brand: { contains: q.trim(), mode: "insensitive" } },
      { supplierName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const parts = await prisma.sparePart.findMany({
    where,
    orderBy: [{ stockQty: "asc" }, { name: "asc" }],
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

  const rows = only === "low_stock"
    ? parts.filter((p) => Number(p.stockQty) <= Number(p.minStockQty))
    : parts;

  return NextResponse.json({ ok: true, rows });
}

const Body = z.object({
  sku: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().max(30).optional().nullable(),
  stockQty: z.coerce.number().min(0).optional(),
  minStockQty: z.coerce.number().min(0).optional(),
  costPerUnitCents: z.coerce.number().int().min(0).optional().nullable(),
  supplierName: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.sparePart.create({
      data: {
        sku: b.sku?.trim() || null,
        name: b.name.trim(),
        category: b.category?.trim() || null,
        brand: b.brand?.trim() || null,
        model: b.model?.trim() || null,
        unit: b.unit?.trim() || null,
        stockQty: b.stockQty ?? 0,
        minStockQty: b.minStockQty ?? 0,
        costPerUnitCents: b.costPerUnitCents ?? null,
        supplierName: b.supplierName?.trim() || null,
        note: b.note?.trim() || null,
        isActive: b.isActive ?? true,
      },
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

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}