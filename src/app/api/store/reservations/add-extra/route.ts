import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeAutoDiscountDetail } from "@/lib/discounts";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  extraServiceId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  pax: z.number().int().min(1).max(30).default(1),
});

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<AppSession>(
      cookieStore as unknown as never,
      sessionOptions
    );
    if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

    const { reservationId, extraServiceId, quantity, pax } = parsed.data;

    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, status: true },
    });
    if (!res) return new NextResponse("Reserva no existe", { status: 404 });

    const extraSvc = await prisma.service.findUnique({
      where: { id: extraServiceId },
      select: { id: true, name: true, category: true, isActive: true },
    });
    if (!extraSvc || !extraSvc.isActive) {
      return new NextResponse("Extra no existe o está inactivo", { status: 404 });
    }
    if (extraSvc.category !== "EXTRA") {
      return new NextResponse("El servicio seleccionado no es un extra", { status: 400 });
    }

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
      return new NextResponse(`Este extra no tiene precio vigente: ${extraSvc.name}`, {
        status: 400,
      });
    }

    const unitPriceCents = Number(price.basePriceCents) || 0;
    const totalPriceCents = unitPriceCents * quantity;

    const result = await prisma.$transaction(async (tx) => {
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

      const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0);
      const newTotal = Number(allSum._sum.totalPriceCents ?? 0);

      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          channelId: true,
          serviceId: true,
          optionId: true,
        },
      });
      if (!reservation) throw new Error("Reserva no existe");

      const channel = reservation.channelId
        ? await tx.channel.findUnique({ where: { id: reservation.channelId }, select: { allowsPromotions: true } })
        : null;
      const promotionsEnabled = channel ? Boolean(channel.allowsPromotions) : true;

      const mainSvc = await tx.service.findUnique({
        where: { id: reservation.serviceId },
        select: { category: true },
      });

      const detail = await computeAutoDiscountDetail({
        when: new Date(),
        item: {
          serviceId: reservation.serviceId,
          optionId: reservation.optionId,
          category: mainSvc?.category ?? null,
          isExtra: false,
          lineBaseCents: serviceSubtotal,
        },
        promoCode: promotionsEnabled ? (reservation.promoCode ?? null) : null,
        customerCountry: reservation.customerCountry ?? null,
        promotionsEnabled,
      });

      const autoDiscountCents = Number(detail.discountCents ?? 0);

      const finalTotal = Math.max(
        0,
        newTotal - Number(reservation.manualDiscountCents ?? 0) - autoDiscountCents
      );

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          basePriceCents: serviceSubtotal,
          autoDiscountCents,
          totalPriceCents: finalTotal,
        },
        select: { id: true },
      });

      await syncStoreFulfillmentTasksForReservation(tx, reservationId);

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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
