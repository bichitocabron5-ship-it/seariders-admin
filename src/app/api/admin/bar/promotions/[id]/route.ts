// src/app/api/admin/bar/promotions/[id]/route.ts
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
  name: z.string().trim().min(1).max(120).optional(),
  type: z.nativeEnum(BarPromotionType).optional(),
  exactQty: z.number().int().positive().optional().nullable(),
  fixedTotalCents: z.number().int().positive().optional().nullable(),
  buyQty: z.number().int().positive().optional().nullable(),
  payQty: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
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
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  const current = await prisma.barPromotion.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      exactQty: true,
      fixedTotalCents: true,
      buyQty: true,
      payQty: true,
    },
  });

  if (!current) {
    return new NextResponse("Promoción no encontrada", { status: 404 });
  }

  const nextType = parsed.data.type ?? current.type;
  const nextExactQty =
    parsed.data.exactQty !== undefined ? parsed.data.exactQty : current.exactQty;
  const nextFixedTotalCents =
    parsed.data.fixedTotalCents !== undefined
      ? parsed.data.fixedTotalCents
      : current.fixedTotalCents;
  const nextBuyQty =
    parsed.data.buyQty !== undefined ? parsed.data.buyQty : current.buyQty;
  const nextPayQty =
    parsed.data.payQty !== undefined ? parsed.data.payQty : current.payQty;

  if (nextType === "FIXED_TOTAL_FOR_QTY") {
    if (!nextExactQty || nextFixedTotalCents == null) {
      return new NextResponse(
        "exactQty y fixedTotalCents son obligatorios.",
        { status: 400 }
      );
    }
  }

  if (nextType === "BUY_X_PAY_Y") {
    if (!nextBuyQty || !nextPayQty) {
      return new NextResponse("buyQty y payQty son obligatorios.", {
        status: 400,
      });
    }
    if (nextPayQty > nextBuyQty) {
      return new NextResponse("payQty no puede ser mayor que buyQty.", {
        status: 400,
      });
    }
  }

  try {
    const row = await prisma.barPromotion.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.exactQty !== undefined
          ? { exactQty: parsed.data.exactQty ?? null }
          : {}),
        ...(parsed.data.fixedTotalCents !== undefined
          ? { fixedTotalCents: parsed.data.fixedTotalCents ?? null }
          : {}),
        ...(parsed.data.buyQty !== undefined
          ? { buyQty: parsed.data.buyQty ?? null }
          : {}),
        ...(parsed.data.payQty !== undefined
          ? { payQty: parsed.data.payQty ?? null }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        ...(parsed.data.startsAt !== undefined
          ? { startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null }
          : {}),
        ...(parsed.data.endsAt !== undefined
          ? { endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null }
          : {}),
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
        startsAt: true,
        endsAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await prisma.barPromotion.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}