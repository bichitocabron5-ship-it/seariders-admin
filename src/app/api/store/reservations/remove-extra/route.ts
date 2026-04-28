import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ReservationStatus } from "@prisma/client";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { getAppliedCommissionPctTx, resolveDiscountPolicy } from "@/lib/commission";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  itemId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function POST(req: Request) {
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

  const { reservationId, itemId, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirst({
        where: { id: reservationId },
        select: {
          id: true,
          status: true,
          source: true,
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          channelId: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
        },
      });
      if (!r) throw new Error("Reserva no existe");

      const allowedStore: ReservationStatus[] = [
        ReservationStatus.WAITING,
        ReservationStatus.READY_FOR_PLATFORM,
        ReservationStatus.SCHEDULED,
        ReservationStatus.IN_SEA,
      ];
      const allowedAdmin: ReservationStatus[] = [
        ...allowedStore,
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELED,
      ];

      const allowed = session.role === "ADMIN" ? allowedAdmin : allowedStore;

      if (!allowed.includes(r.status as ReservationStatus)) {
        throw new Error("No se pueden modificar extras en este estado");
      }

      if (
        (r.status === ReservationStatus.COMPLETED ||
          r.status === ReservationStatus.CANCELED) &&
        session.role !== "ADMIN"
      ) {
        throw new Error("Solo ADMIN puede modificar extras post-cierre");
      }

      if (
        (r.status === ReservationStatus.COMPLETED ||
          r.status === ReservationStatus.CANCELED) &&
        (!reason || reason.trim().length < 3)
      ) {
        throw new Error("Indica un motivo para el ajuste post-cierre");
      }

      const item = await tx.reservationItem.findFirst({
        where: { id: itemId, reservationId },
        select: { id: true, isExtra: true },
      });
      if (!item) throw new Error("Item no existe");
      if (!item.isExtra) throw new Error("No se puede borrar el item principal");

      await tx.reservationItem.delete({ where: { id: itemId } });

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

      const serviceSubtotal = items
        .filter((item) => !item.isExtra)
        .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);
      const newTotal = items.reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);

      const isBoothReservation = r.source === "BOOTH";
      const channel = r.channelId
        ? await tx.channel.findUnique({
            where: { id: r.channelId },
            select: {
              allowsPromotions: true,
              discountResponsibility: true,
              promoterDiscountShareBps: true,
            },
          })
        : null;
      const promotionsEnabled = isBoothReservation ? false : (channel ? Boolean(channel.allowsPromotions) : true);
      const discountPolicy = resolveDiscountPolicy({
        responsibility: r.discountResponsibility,
        promoterDiscountShareBps: r.promoterDiscountShareBps,
        channel,
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
            promoCode: promotionsEnabled ? (r.promoCode ?? null) : null,
          })),
        customerCountry: r.customerCountry ?? null,
        promotionsEnabled,
        totalBeforeDiscountsCents: newTotal,
        manualDiscountCents: Number(r.manualDiscountCents ?? 0),
        discountResponsibility: discountPolicy.discountResponsibility,
        promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
      });
      const appliedCommissionPct = await getAppliedCommissionPctTx(tx, {
        channelId: r.channelId,
        serviceId: items.find((item) => !item.isExtra)?.serviceId ?? null,
      });

      const updated = await tx.reservation.update({
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
        select: { id: true, totalPriceCents: true },
      });

      await syncStoreFulfillmentTasksForReservation(tx, reservationId);

      return { reservation: updated };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error interno";
    return new NextResponse(message, { status: 400 });
  }
}
