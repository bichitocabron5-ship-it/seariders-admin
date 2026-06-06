import type { Prisma } from "@prisma/client";
import { ExtraTimeStatus } from "@prisma/client";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import {
  getAppliedCommercialSnapshotTx,
  resolveCustomerDiscountSnapshot,
  resolveDiscountPolicy,
} from "@/lib/commission";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";
import { syncChannelCommissionLineFromReservationTx } from "@/lib/channel-commission-lines";

export async function applyPlatformExtraEventsTx(
  tx: Prisma.TransactionClient,
  reservationId: string,
  eventIds?: string[]
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      pax: true,
      source: true,
      manualDiscountCents: true,
      promoCode: true,
      customerCountry: true,
      channelId: true,
      quantity: true,
      serviceId: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
    },
  });
  if (!reservation) throw new Error("Reserva no existe");

  const events = await tx.extraTimeEvent.findMany({
    where: {
      reservationId,
      status: ExtraTimeStatus.PENDING,
      ...(eventIds?.length ? { id: { in: eventIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      serviceCode: true,
      extraMinutes: true,
    },
  });

  if (!events.length) {
    return {
      ok: true,
      reservationId,
      applied: 0,
      createdItems: [],
      message: "No hay extras pendientes de plataforma.",
    };
  }

  const grouped = new Map<string, { qty: number; minutesTotal: number; eventIds: string[] }>();
  for (const event of events) {
    const key = String(event.serviceCode);
    const current = grouped.get(key) ?? { qty: 0, minutesTotal: 0, eventIds: [] };
    current.qty += 1;
    current.minutesTotal += Number(event.extraMinutes ?? 0);
    current.eventIds.push(event.id);
    grouped.set(key, current);
  }

  const serviceCodes = Array.from(grouped.keys());
  const services = await tx.service.findMany({
    where: { code: { in: serviceCodes } },
    select: { id: true, code: true, name: true },
  });

  const servicesByCode = new Map(services.map((service) => [String(service.code), service]));
  const missing = serviceCodes.filter((code) => !servicesByCode.has(code));
  if (missing.length) {
    throw new Error(`Servicios extra no encontrados en catálogo: ${missing.join(", ")}`);
  }

  const createdItems: Array<{
    serviceCode: string;
    serviceId: string;
    quantity: number;
    minutesTotal: number;
    serviceName: string;
  }> = [];

  for (const [serviceCode, info] of grouped.entries()) {
    const service = servicesByCode.get(serviceCode)!;
    const now = new Date();
    const price = await tx.servicePrice.findFirst({
      where: {
        serviceId: service.id,
        optionId: null,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });

    if (!price) {
      throw new Error(`No hay precio vigente para el extra ${service.code}`);
    }

    const unitPriceCents = Number(price.basePriceCents ?? 0);
    await tx.reservationItem.create({
      data: {
        reservationId,
        serviceId: service.id,
        servicePriceId: price.id,
        quantity: info.qty,
        pax: Math.max(1, Number(reservation.pax ?? 1)),
        unitPriceCents,
        totalPriceCents: unitPriceCents * info.qty,
        isExtra: true,
      },
      select: { id: true },
    });

    createdItems.push({
      serviceCode,
      serviceId: service.id,
      quantity: info.qty,
      minutesTotal: info.minutesTotal,
      serviceName: service.name,
    });
  }

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

  const isBoothReservation = reservation.source === "BOOTH";
  const channel = reservation.channelId
    ? await tx.channel.findUnique({
        where: { id: reservation.channelId },
        select: {
          allowsPromotions: true,
          customerDiscountMode: true,
          customerDiscountValue: true,
          customerDiscountCents: true,
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
  const customerDiscountSnapshot = resolveCustomerDiscountSnapshot({
    channel,
    quantity: reservation.quantity,
    baseCents: newTotal,
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
    customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
    manualDiscountCents: Number(reservation.manualDiscountCents ?? 0),
    discountResponsibility: discountPolicy.discountResponsibility,
    promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
  });
  const commercialSnapshot = await getAppliedCommercialSnapshotTx(tx, {
    channelId: reservation.channelId,
    serviceId: reservation.serviceId,
    commissionBaseCents: commercial.commissionBaseCents,
    finalTotalCents: commercial.finalTotalCents,
    customerDiscountBaseCents: newTotal,
    quantity: reservation.quantity,
  });

  await tx.reservation.update({
    where: { id: reservationId },
    data: {
      basePriceCents: serviceSubtotal,
      commissionBaseCents: commercial.commissionBaseCents,
      appliedCommissionPct: commercialSnapshot.appliedCommissionPct,
      appliedCommissionMode: commercialSnapshot.appliedCommissionMode,
      appliedCommissionValue: commercialSnapshot.appliedCommissionValue,
      appliedCommissionCents: commercialSnapshot.appliedCommissionCents,
      customerDiscountMode: customerDiscountSnapshot.customerDiscountMode,
      customerDiscountValue: customerDiscountSnapshot.customerDiscountValue,
      customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
      autoDiscountCents: commercial.autoDiscountCents,
      manualDiscountCents: commercial.manualDiscountCents,
      discountResponsibility: commercial.discountResponsibility,
      promoterDiscountShareBps: commercial.promoterDiscountShareBps,
      promoterDiscountCents: commercial.promoterDiscountCents,
      companyDiscountCents: commercial.companyDiscountCents,
      promoCode: commercial.promoCode,
      totalPriceCents: commercial.finalTotalCents,
    },
  });

  await tx.extraTimeEvent.updateMany({
    where: {
      id: { in: events.map((event) => event.id) },
      status: ExtraTimeStatus.PENDING,
    },
    data: {
      status: ExtraTimeStatus.CHARGED,
    },
  });

  await syncChannelCommissionLineFromReservationTx(tx, reservationId);
  await syncStoreFulfillmentTasksForReservation(tx, reservationId);

  return {
    ok: true,
    reservationId,
    applied: events.length,
    createdItems,
  };
}
