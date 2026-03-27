// src/app/api/admin/bar/promotions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { BarPromotionType } from "@prisma/client";

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
  productId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  type: z.nativeEnum(BarPromotionType),
  exactQty: z.number().int().positive().optional().nullable(),
  fixedTotalCents: z.number().int().positive().optional().nullable(),
  buyQty: z.number().int().positive().optional().nullable(),
  payQty: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.barPromotion.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      exactQty: true,
      fixedTotalCents: true,
      buyQty: true,
      payQty: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  const b = parsed.data;

  if (b.type === "FIXED_TOTAL_FOR_QTY") {
    if (!b.exactQty || b.fixedTotalCents == null) {
      return new NextResponse("exactQty y fixedTotalCents son obligatorios.", { status: 400 });
    }
  }

  if (b.type === "BUY_X_PAY_Y") {
    if (!b.buyQty || !b.payQty) {
      return new NextResponse("buyQty y payQty son obligatorios.", { status: 400 });
    }
    if (b.payQty > b.buyQty) {
      return new NextResponse("payQty no puede ser mayor que buyQty.", { status: 400 });
    }
  }

  try {
    const row = await prisma.barPromotion.create({
      data: {
        productId: b.productId,
        name: b.name,
        type: b.type,
        exactQty: b.type === "FIXED_TOTAL_FOR_QTY" ? b.exactQty ?? null : null,
        fixedTotalCents: b.type === "FIXED_TOTAL_FOR_QTY" ? b.fixedTotalCents ?? null : null,
        buyQty: b.type === "BUY_X_PAY_Y" ? b.buyQty ?? null : null,
        payQty: b.type === "BUY_X_PAY_Y" ? b.payQty ?? null : null,
        isActive: b.isActive ?? true,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        exactQty: true,
        fixedTotalCents: true,
        buyQty: true,
        payQty: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}