import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { getAppliedCommissionPctTx, resolveDiscountPolicy } from "@/lib/commission";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";

export const runtime = "nodejs";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function inferExtraTarget(service: {
  code?: string | null;
  name?: string | null;
}): "JETSKI" | "BOAT" | null {
  const code = normalizeText(service.code);
  const name = normalizeText(service.name);
  const haystack = `${code} ${name}`;

  if (!haystack.trim()) return null;
  if (haystack.includes("jetski") || haystack.includes("moto")) return "JETSKI";
  if (haystack.includes("boat") || haystack.includes("barco") || haystack.includes("nautica")) return "BOAT";
  return null;
}

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
      select: {
        id: true,
        status: true,
        service: { select: { category: true, code: true, name: true } },
      },
    });
    if (!res) return new NextResponse("Reserva no existe", { status: 404 });

    const extraSvc = await prisma.service.findUnique({
      where: { id: extraServiceId },
      select: { id: true, name: true, code: true, category: true, isActive: true },
    });
    if (!extraSvc || !extraSvc.isActive) {
      return new NextResponse("Extra no existe o está inactivo", { status: 404 });
    }
    if (extraSvc.category !== "EXTRA") {
      return new NextResponse("El servicio seleccionado no es un extra", { status: 400 });
    }

    const reservationCategory = String(res.service?.category ?? "").toUpperCase();
    const extraTarget = inferExtraTarget(extraSvc);
    if (extraTarget === "JETSKI" && reservationCategory !== "JETSKI") {
      return new NextResponse("Este extra es solo para reservas de jetski", { status: 400 });
    }
    if (extraTarget === "BOAT" && reservationCategory === "JETSKI") {
      return new NextResponse("Este extra no es compatible con una reserva de jetski", { status: 400 });
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
          _sum: { totalPriceCents: true, quantity: true },
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
          source: true,
          serviceId: true,
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          channelId: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
        },
      });
      if (!reservation) throw new Error("Reserva no existe");

      const isBoothReservation = reservation.source === "BOOTH";
      const channel = reservation.channelId
        ? await tx.channel.findUnique({
            where: { id: reservation.channelId },
            select: {
              allowsPromotions: true,
              discountResponsibility: true,
              promoterDiscountShareBps: true,
            },
          })
        : null;
      const promotionsEnabled = isBoothReservation ? false : (channel ? Boolean(channel.allowsPromotions) : true);
      const discountPolicy = resolveDiscountPolicy({
        responsibility: reservation.discountResponsibility,
        promoterDiscountShareBps: reservation.promoterDiscountShareBps,
        channel,
      });
      const items = await tx.reservationItem.findMany({
        where: { reservationId },
        select: {
          serviceId: true,
          optionId: true,
          quantity: true,
          totalPriceCents: true,
          isExtra: true,
          service: { select: { category: true } },
        },
      });
      const commercial = await computeReservationCommercialBreakdown({
        when: new Date(),
        discountLines: items
          .filter((item) => !item.isExtra)
          .map((item) => ({
            serviceId: item.serviceId,
            optionId: item.optionId,
            category: item.service?.category ?? null,
            quantity: Number(item.quantity ?? 0),
            lineBaseCents: Number(item.totalPriceCents ?? 0),
            promoCode: promotionsEnabled ? (reservation.promoCode ?? null) : null,
          })),
        customerCountry: reservation.customerCountry ?? null,
        promotionsEnabled,
        totalBeforeDiscountsCents: newTotal,
        manualDiscountCents: Number(reservation.manualDiscountCents ?? 0),
        discountResponsibility: discountPolicy.discountResponsibility,
        promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
      });
      const appliedCommissionPct = await getAppliedCommissionPctTx(tx, {
        channelId: reservation.channelId,
        serviceId: reservation.serviceId,
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          basePriceCents: serviceSubtotal,
          commissionBaseCents: commercial.commissionBaseCents,
          appliedCommissionPct,
          autoDiscountCents: commercial.autoDiscountCents,
          manualDiscountCents: commercial.manualDiscountCents,
          discountResponsibility: commercial.discountResponsibility,
          promoterDiscountShareBps: commercial.promoterDiscountShareBps,
          promoterDiscountCents: commercial.promoterDiscountCents,
          companyDiscountCents: commercial.companyDiscountCents,
          promoCode: commercial.promoCode,
          totalPriceCents: commercial.finalTotalCents,
        },
        select: { id: true },
      });

      await syncStoreFulfillmentTasksForReservation(tx, reservationId);

      return {
        serviceSubtotalCents: serviceSubtotal,
        newTotalBeforeDiscountsCents: newTotal,
        autoDiscountCents: commercial.autoDiscountCents,
        finalTotalCents: commercial.finalTotalCents,
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
