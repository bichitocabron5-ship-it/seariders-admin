// src/app/api/store/reservations/add-extra/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeAutoDiscountDetail } from "@/lib/discounts";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  extraServiceId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  pax: z.number().int().min(1).max(30).default(1),
});

export async function POST(req: Request) {
  try {
    // âœ… Auth (STORE o ADMIN)
    const cookieStore = await cookies();
    const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
    if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

    const { reservationId, extraServiceId, quantity, pax } = parsed.data;

    // âœ… Reserva existe (mÃ­nimo)
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, status: true },
    });
    if (!res) return new NextResponse("Reserva no existe", { status: 404 });

    // âœ… Validar que el servicio es EXTRA
    const extraSvc = await prisma.service.findUnique({
      where: { id: extraServiceId },
      select: { id: true, name: true, category: true, isActive: true },
    });
    if (!extraSvc || !extraSvc.isActive) return new NextResponse("Extra no existe o estÃ¡ inactivo", { status: 404 });
    if (extraSvc.category !== "EXTRA") return new NextResponse("El servicio seleccionado no es un extra", { status: 400 });

    // âœ… Precio vigente para extra: durationMin = null (legacy)
    const now = new Date();
    const price = await prisma.servicePrice.findFirst({
      where: {
        serviceId: extraServiceId,
        durationMin: null,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });

    if (!price) {
      return new NextResponse(`Este extra no tiene precio vigente: ${extraSvc.name}`, { status: 400 });
    }

    const unitPriceCents = Number(price.basePriceCents) || 0;
    const totalPriceCents = unitPriceCents * quantity;

    const result = await prisma.$transaction(async (tx) => {
      // 1) crear item extra
      await tx.reservationItem.create({
        data: {
          reservationId,
          serviceId: extraServiceId,
          optionId: null,
          servicePriceId: price.id,
          quantity,
          pax,
          unitPriceCents,
          totalPriceCents,
          isExtra: true,
        },
        select: { id: true },
      });

      // 2) sumas eficientes (principal vs total)
      const [mainSum, allSum] = await Promise.all([
        tx.reservationItem.aggregate({
          where: { reservationId, isExtra: false },
          _sum: { totalPriceCents: true },
        }),
        tx.reservationItem.aggregate({
          where: { reservationId },
          _sum: { totalPriceCents: true },
        }),
      ]);

      const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0); // SOLO principal
      const newTotal = Number(allSum._sum.totalPriceCents ?? 0); // principal + extras

      // 3) cargar reserva (promo/manual + customerCountry + ids principal)
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          serviceId: true,
          optionId: true,
        },
      });
      if (!reservation) throw new Error("Reserva no existe");

      // 3.1) categorÃ­a del servicio principal (para auto descuento)
      const mainSvc = await tx.service.findUnique({
        where: { id: reservation.serviceId },
        select: { category: true },
      });

      // 4) auto descuento SOLO sobre principal (nunca sobre extras)
      const detail = await computeAutoDiscountDetail({
        when: new Date(),
        item: {
          serviceId: reservation.serviceId,
          optionId: reservation.optionId,
          category: mainSvc?.category ?? null,
          isExtra: false,
          lineBaseCents: serviceSubtotal,
        },
        promoCode: reservation.promoCode ?? null,
        customerCountry: reservation.customerCountry ?? null,
      });

      const autoDiscountCents = Number(detail.discountCents ?? 0);

      // 5) total final = (principal + extras) - manual - auto
      const finalTotal = Math.max(
        0,
        newTotal - Number(reservation.manualDiscountCents ?? 0) - autoDiscountCents
      );

      // 6) persistir
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          basePriceCents: serviceSubtotal, // âœ… comisionable = principal
          autoDiscountCents,
          totalPriceCents: finalTotal, // âœ… cliente paga (incluye extras)
        },
        select: { id: true },
      });

      return {
        serviceSubtotalCents: serviceSubtotal,
        newTotalBeforeDiscountsCents: newTotal,
        autoDiscountCents,
        finalTotalCents: finalTotal,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("add-extra error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}


