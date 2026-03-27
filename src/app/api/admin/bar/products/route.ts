// src/app/api/admin/bar/products/route.ts
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

const Query = z.object({
  categoryId: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const CreateBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  type: z.nativeEnum(BarProductType),
  sku: z.string().trim().max(60).optional().nullable(),
  salePriceCents: z.number().int().nonnegative(),
  vatRate: z.number().min(0).max(100),
  controlsStock: z.boolean().optional(),
  currentStock: z.number().optional(),
  minStock: z.number().optional(),
  unitLabel: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  staffEligible: z.boolean().optional(),
  staffPriceCents: z.number().int().nonnegative().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Query.safeParse({
    categoryId: u.searchParams.get("categoryId") ?? undefined,
    active: u.searchParams.get("active") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Parámetros inválidos", { status: 400 });

  const rows = await prisma.barProduct.findMany({
    where: {
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      ...(parsed.data.active ? { isActive: parsed.data.active === "true" } : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      sku: true,
      salePriceCents: true,
      vatRate: true,
      controlsStock: true,
      currentStock: true,
      minStock: true,
      unitLabel: true,
      isActive: true,
      staffEligible: true,
      staffPriceCents: true,
      category: {
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  try {
    const row = await prisma.barProduct.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        type: parsed.data.type,
        sku: parsed.data.sku?.trim() || null,
        salePriceCents: parsed.data.salePriceCents,
        vatRate: parsed.data.vatRate,
        controlsStock: parsed.data.controlsStock ?? true,
        currentStock: parsed.data.currentStock ?? 0,
        minStock: parsed.data.minStock ?? 0,
        unitLabel: parsed.data.unitLabel?.trim() || null,
        isActive: parsed.data.isActive ?? true,
        staffEligible: parsed.data.staffEligible ?? false,
        staffPriceCents: parsed.data.staffPriceCents ?? null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        salePriceCents: true,
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