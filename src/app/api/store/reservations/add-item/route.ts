import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeAutoDiscountDetail } from "@/lib/discounts";
import { getBoothUnitDiscountCents, getScaledBoothDiscountCents } from "@/lib/booth-discount";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),

  serviceId: z.string().min(1),
  optionId: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(50).default(1),
  pax: z.number().int().min(1).max(30).default(1),
  isExtra: z.boolean().default(true),
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

    const { reservationId, serviceId, optionId, quantity, pax, isExtra } = parsed.data;

    const [svc, reservation] = await Promise.all([
      prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, name: true, category: true, isActive: true },
      }),
      prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true },
      }),
    ]);

    if (!reservation) return new NextResponse("Reserva no existe", { status: 404 });
    if (!svc || !svc.isActive) {
      return new NextResponse("Servicio no existe o está inactivo", { status: 404 });
    }

    const now = new Date();
    let durationMin: number | null = null;

    if (svc.category === "EXTRA") {
      durationMin = null;
      if (optionId) return new NextResponse("Los extras no llevan opción", { status: 400 });
    } else {
      if (!optionId) return new NextResponse("Falta optionId para este servicio", { status: 400 });

      const opt = await prisma.serviceOption.findFirst({
        where: { id: optionId, serviceId, isActive: true },
        select: { durationMinutes: true, paxMax: true },
      });
      if (!opt) return new NextResponse("Opción inválida", { status: 400 });
      if (pax > opt.paxMax) {
        return new NextResponse(`PAX máximo para esta opción: ${opt.paxMax}`, {
          status: 400,
        });
      }

      durationMin = opt.durationMinutes;
    }

    const price = await prisma.servicePrice.findFirst({
      where: {
        serviceId,
        durationMin,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });

    if (!price) {
      const label = svc.category === "EXTRA" ? "extra" : "servicio/duración";
      return new NextResponse(`Este ${label} no tiene precio vigente (Admin > Precios).`, {
        status: 400,
      });
    }

    const unitPriceCents = Number(price.basePriceCents);
    const totalPriceCents = unitPriceCents * quantity;

    const result = await prisma.$transaction(async (tx) => {
      await tx.reservationItem.create({
        data: {
          reservationId,
          serviceId,
          optionId: svc.category === "EXTRA" ? null : optionId,
          servicePriceId: price.id,
          quantity,
          pax,
          unitPriceCents,
          totalPriceCents,
          isExtra,
        },
      });

      const [mainSum, allSum] = await Promise.all([
        tx.reservationItem.aggregate({
          where: { reservationId, isExtra: false },
          _sum: { totalPriceCents: true, quantity: true },
        }),
        tx.reservationItem.aggregate({
          where: { reservationId },
          _sum: { totalPriceCents: true },
        }),
      ]);

      const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0);
      const mainQuantity = Number(mainSum._sum.quantity ?? 1);
      const newTotal = Number(allSum._sum.totalPriceCents ?? 0);

      const reservationPricing = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          source: true,
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          channelId: true,
          serviceId: true,
          optionId: true,
          items: {
            where: { isExtra: false },
            select: {
              serviceId: true,
              optionId: true,
              quantity: true,
            },
          },
        },
      });
      if (!reservationPricing) throw new Error("Reserva no existe");

      const isBoothReservation = reservationPricing.source === "BOOTH";
      const channel = reservationPricing.channelId
        ? await tx.channel.findUnique({ where: { id: reservationPricing.channelId }, select: { allowsPromotions: true } })
        : null;
      const promotionsEnabled = isBoothReservation ? false : (channel ? Boolean(channel.allowsPromotions) : true);

      const mainSvc = await tx.service.findUnique({
        where: { id: reservationPricing.serviceId },
        select: { category: true },
      });

      const autoDiscountCents = isBoothReservation
        ? 0
        : Number((await computeAutoDiscountDetail({
            when: new Date(),
            item: {
              serviceId: reservationPricing.serviceId,
              optionId: reservationPricing.optionId,
              category: mainSvc?.category ?? null,
              isExtra: false,
              lineBaseCents: serviceSubtotal,
              quantity: mainQuantity,
            },
            promoCode: promotionsEnabled ? (reservationPricing.promoCode ?? null) : null,
            customerCountry: reservationPricing.customerCountry ?? null,
            promotionsEnabled,
          })).discountCents ?? 0);
      const currentMatchingQuantity = (reservationPricing.items ?? []).reduce(
        (sum, item) =>
          item.serviceId === reservationPricing.serviceId &&
          item.optionId === reservationPricing.optionId
            ? sum + Number(item.quantity ?? 0)
            : sum,
        0
      );
      const boothUnitDiscountCents = getBoothUnitDiscountCents({
        source: reservationPricing.source,
        matchingQuantity: currentMatchingQuantity,
        manualDiscountCents: reservationPricing.manualDiscountCents,
      });
      const nextMatchingQuantity =
        !isExtra &&
        serviceId === reservationPricing.serviceId &&
        optionId === reservationPricing.optionId
          ? currentMatchingQuantity + quantity
          : currentMatchingQuantity;
      const manualDiscountCents = isBoothReservation
        ? getScaledBoothDiscountCents({
            boothUnitDiscountCents,
            nextMatchingQuantity,
          })
        : Number(reservationPricing.manualDiscountCents ?? 0);
      const finalTotal = Math.max(
        0,
        newTotal - manualDiscountCents - autoDiscountCents
      );

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          basePriceCents: serviceSubtotal,
          autoDiscountCents,
          manualDiscountCents,
          promoCode: isBoothReservation ? null : reservationPricing.promoCode ?? null,
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
