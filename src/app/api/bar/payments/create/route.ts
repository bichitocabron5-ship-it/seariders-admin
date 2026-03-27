// src/app/api/bar/payments/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentMethod, PaymentOrigin, PaymentDirection, RoleName } from "@prisma/client";
import { originFromRoleName, parseBusinessDate } from "@/lib/cashClosures";
import { calculateBarLineTotal } from "@/lib/bar-pricing";

export const runtime = "nodejs";

const Body = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(999),
  amountCents: z.number().int().positive(),
  method: z.nativeEnum(PaymentMethod),
  note: z.string().max(300).optional().nullable(),
  date: z.string().min(10).max(10),
  shift: z.enum(["MORNING", "AFTERNOON"]),
  label: z.string().min(1).max(120),
  staffMode: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== PaymentOrigin.BAR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  const { productId, quantity, amountCents, method, date, shift, label, staffMode } = parsed.data;
  const businessDate = parseBusinessDate(date);

  const d0 = new Date(businessDate);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(businessDate);
  d1.setHours(23, 59, 59, 999);

  try {
    const shiftSession = await prisma.shiftSession.findFirst({
      where: {
        userId: session.userId,
        shift,
        startedAt: { gte: d0, lte: d1 },
        role: { name: { in: ["BAR", "ADMIN"] as RoleName[] } },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (!shiftSession && String(session.role) !== "ADMIN") {
      return new NextResponse(
        "No hay shift session abierta para BAR en ese turno/día.",
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.barProduct.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          salePriceCents: true,
          staffEligible: true,
          staffPriceCents: true,
          isActive: true,
          controlsStock: true,
          currentStock: true,
          unitLabel: true,
        },
      });

      if (!product || !product.isActive) {
        throw new Error("Producto no encontrado o inactivo.");
      }

      const currentStock = Number(product.currentStock ?? 0);

      if (product.controlsStock && currentStock < quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}.`);
      }

      const unitPriceCents =
        staffMode && product.staffEligible && product.staffPriceCents != null
          ? Number(product.staffPriceCents)
          : Number(product.salePriceCents);

      // IMPORTANTE: cargar promos
      const promotions = await tx.barPromotion.findMany({
        where: {
          productId: product.id,
          isActive: true,
        },
      });

      // CALCULAR PRECIO REAL
      const pricing = calculateBarLineTotal({
        unitPriceCents,
        quantity,
        promotions,
        staffMode,
        staffPriceCents: product.staffPriceCents,
      });

      if (amountCents !== pricing.totalCents) {
        throw new Error("El importe no coincide con el precio calculado.");
      }

      const payment = await tx.payment.create({
        data: {
          origin: PaymentOrigin.BAR,
          direction: PaymentDirection.IN,
          method,
          amountCents,
          isDeposit: false,
          shiftSessionId: shiftSession?.id ?? null,
          createdByUserId: session.userId,
        },
        select: {
          id: true,
          amountCents: true,
          method: true,
          origin: true,
          createdAt: true,
        },
      });

      let updatedProduct: { id: string; currentStock: unknown } | null = null;

      if (product.controlsStock) {
        const nextStock = currentStock - quantity;

        updatedProduct = await tx.barProduct.update({
          where: { id: product.id },
          data: {
            currentStock: nextStock,
          },
          select: {
            id: true,
            currentStock: true,
          },
        });

        await tx.barStockMovement.create({
          data: {
            productId: product.id,
            type: "OUT",
            reason: "BAR_SALE",
            quantity,
            stockBefore: currentStock,
            stockAfter: nextStock,
            notes: `Venta directa BAR${staffMode ? " · STAFF" : ""} · ${label} · x${quantity}`,
            sourceType: "PAYMENT",
            sourceId: payment.id,
            userId: session.userId,
          },
        });
      }

      return {
        payment,
        product: updatedProduct,
      };
    });

    return NextResponse.json({
      ok: true,
      payment: result.payment,
      product: result.product,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}