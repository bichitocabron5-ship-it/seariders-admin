// src/app/api/mechanics/parts/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Body = z.object({
  sku: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(1).max(160).optional(),
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.sparePart.update({
      where: { id },
      data: {
        ...(b.sku !== undefined ? { sku: b.sku?.trim() || null } : {}),
        ...(b.name !== undefined ? { name: b.name.trim() } : {}),
        ...(b.category !== undefined ? { category: b.category?.trim() || null } : {}),
        ...(b.brand !== undefined ? { brand: b.brand?.trim() || null } : {}),
        ...(b.model !== undefined ? { model: b.model?.trim() || null } : {}),
        ...(b.unit !== undefined ? { unit: b.unit?.trim() || null } : {}),
        ...(b.stockQty !== undefined ? { stockQty: b.stockQty } : {}),
        ...(b.minStockQty !== undefined ? { minStockQty: b.minStockQty } : {}),
        ...(b.costPerUnitCents !== undefined ? { costPerUnitCents: b.costPerUnitCents } : {}),
        ...(b.supplierName !== undefined ? { supplierName: b.supplierName?.trim() || null } : {}),
        ...(b.note !== undefined ? { note: b.note?.trim() || null } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
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

