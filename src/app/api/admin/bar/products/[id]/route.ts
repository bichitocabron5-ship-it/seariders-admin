// src/app/api/admin/bar/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { BarProductType } from "@prisma/client";

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

const PatchBody = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  type: z.nativeEnum(BarProductType).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  salePriceCents: z.number().int().nonnegative().optional(),
  costPriceCents: z.number().int().nonnegative().optional().nullable(),
  vatRate: z.number().min(0).max(100).optional(),
  controlsStock: z.boolean().optional(),
  currentStock: z.number().optional(),
  minStock: z.number().optional(),
  unitLabel: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  staffEligible: z.boolean().optional(),
  staffPriceCents: z.number().int().nonnegative().optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  try {
    const row = await prisma.barProduct.update({
      where: { id },
      data: {
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.sku !== undefined ? { sku: parsed.data.sku?.trim() || null } : {}),
        ...(parsed.data.salePriceCents !== undefined ? { salePriceCents: parsed.data.salePriceCents } : {}),
        ...(parsed.data.costPriceCents !== undefined ? { costPriceCents: parsed.data.costPriceCents } : {}),
        ...(parsed.data.vatRate !== undefined ? { vatRate: parsed.data.vatRate } : {}),
        ...(parsed.data.controlsStock !== undefined ? { controlsStock: parsed.data.controlsStock } : {}),
        ...(parsed.data.currentStock !== undefined ? { currentStock: parsed.data.currentStock } : {}),
        ...(parsed.data.minStock !== undefined ? { minStock: parsed.data.minStock } : {}),
        ...(parsed.data.unitLabel !== undefined ? { unitLabel: parsed.data.unitLabel?.trim() || null } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.staffEligible !== undefined ? { staffEligible: parsed.data.staffEligible } : {}),
        ...(parsed.data.staffPriceCents !== undefined ? { staffPriceCents: parsed.data.staffPriceCents } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        salePriceCents: true,
        costPriceCents: true,
        vatRate: true,
        controlsStock: true,
        currentStock: true,
        minStock: true,
        unitLabel: true,
        isActive: true,
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}