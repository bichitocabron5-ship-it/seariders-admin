// src/app/api/store/reservations/today/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { deriveReservationDepositStatus } from "@/lib/reservation-deposits";
import { deriveStoreFlowStage } from "@/lib/store-flow-stage";
import { countReadyVisibleContracts } from "@/lib/contracts/active-contracts";
import { buildStoreTodayWhere } from "@/lib/store-reservation-visibility";
import { buildReservationJetskiAssignments } from "@/lib/jetski-assignment-history";
import { getReservationPaymentStatus } from "@/lib/reservation-payment-status";
import { getBusinessDayRange } from "@/lib/business-day";

export const runtime = "nodejs";

export async function GET() {
  // ✅ App Router: cookies() + getIronSession(cookieStore)
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start, endExclusive } = getBusinessDayRange();

  const rowsDb = await prisma.reservation.findMany({
    where: buildStoreTodayWhere({ start, endExclusive }),
    orderBy: [{ scheduledTime: "asc" }, { activityDate: "asc" }],
    select: {
      id: true,
      status: true,
      arrivalAt: true,
      activityDate: true,
      scheduledTime: true,
      companionsCount: true,

      customerName: true,
      customerCountry: true,
      formalizedAt: true,

      // legacy (convivencia)
      quantity: true,
      pax: true,
      basePriceCents: true,
      totalPriceCents: true,
      commissionBaseCents: true,
      appliedCommissionMode: true,
      appliedCommissionValue: true,
      appliedCommissionPct: true,
      appliedCommissionCents: true,
      depositCents: true,
      isLicense: true,     
      customerDiscountCents: true,
      autoDiscountCents: true,
      manualDiscountCents: true,
      promoterDiscountCents: true,
      companyDiscountCents: true,
      manualDiscountReason: true,
      
      isPackParent: true,
      packId: true,

      source: true,
      boothCode: true,
      boothNote: true,
      arrivedStoreAt: true,

      taxiboatTripId: true,
      taxiboatAssignedAt: true,
      taxiboatTrip: { select: { boat: true, tripNo: true, departedAt: true } },

      channel: { select: { name: true } },
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },

      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          pax: true,
          unitPriceCents: true,
          totalPriceCents: true,
          isExtra: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
      },

      extraTimeEvents: {
        where: { status: "PENDING" },
        select: { id: true },
      },

      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          amountCents: true,
          isDeposit: true,
          direction: true,
          method: true,
          origin: true,
          createdAt: true,
        },
      },

      contracts: {
        select: { status: true, unitIndex: true, logicalUnitIndex: true, supersededAt: true, createdAt: true },
      },

      depositHeld: true,
      depositHoldReason: true,
      units: {
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          jetskiId: true,
          jetski: { select: { id: true, number: true } },
        },
      },
      monitorRunAssignments: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          reservationId: true,
          reservationUnitId: true,
          status: true,
          createdAt: true,
          startedAt: true,
          expectedEndAt: true,
          endedAt: true,
          jetskiId: true,
          jetski: { select: { id: true, number: true } },
        },
      },
    },
  });

  const rows = rowsDb.map((r) => {
    // pagos netos
    const paidCents = r.payments.reduce((sum, p) => {
      const sign = p.direction === "OUT" ? -1 : 1;
      return sum + sign * p.amountCents;
    }, 0);

    const paymentStatus = getReservationPaymentStatus({
      totalPriceCents: r.totalPriceCents,
      depositCents: r.depositCents,
      quantity: r.quantity,
      isLicense: Boolean(r.isLicense),
      serviceCategory: r.service?.category,
      items: r.items,
      payments: r.payments,
    });
    const paidServiceCents = paymentStatus.paidServiceCents;
    const paidDepositCents = paymentStatus.paidDepositCents;
    const refundableDepositCents = Math.max(0, paidDepositCents);
    const depositCents = paymentStatus.depositDueCents;

    // items principal + extras
    const mainItem = r.items.find((it) => !it.isExtra) ?? null;
    const extras = r.items.filter((it) => it.isExtra);

    const serviceTotalCents = r.items
      .filter((it) => !it.isExtra)
      .reduce((sum, it) => sum + (it.totalPriceCents ?? 0), 0);

    const extrasTotalCents = r.items
      .filter((it) => it.isExtra)
      .reduce((sum, it) => sum + (it.totalPriceCents ?? 0), 0);

    // ✅ total vendible (servicio + extras)
    // Si aún no hay items (reserva vieja), fallback a legacy totalPriceCents
    const autoDisc = Number(r.autoDiscountCents ?? 0);
    const manualDisc = Number(r.manualDiscountCents ?? 0);
    const promoterDisc = Number(r.promoterDiscountCents ?? 0);
    const companyDisc = Number(r.companyDiscountCents ?? 0);
    const channelCustomerDiscountCents = Number(r.customerDiscountCents ?? 0);
    const totalDiscountCents = channelCustomerDiscountCents + autoDisc + manualDisc;

    const isPack = Boolean(r.isPackParent && r.packId);
    const legacyGrossCents = Number(r.totalPriceCents ?? 0) + totalDiscountCents;

    const grossCents = isPack
      ? legacyGrossCents
      : (r.items.length > 0
          ? serviceTotalCents + extrasTotalCents
          : legacyGrossCents);

    const soldTotalCents = Math.max(0, Number(r.totalPriceCents ?? Math.max(0, grossCents - totalDiscountCents)));
 
    // pendientes separados (✅ servicio basado en items)
    const pendingServiceCents = paymentStatus.pendingServiceCents;
    const pendingDepositCents = paymentStatus.pendingDepositCents;
    const pendingCents = pendingServiceCents + pendingDepositCents;

    const requiredUnits = computeRequiredContractUnits({
      quantity: r.quantity,
      isLicense: Boolean(r.isLicense),
      serviceCategory: r.service?.category ?? null,
      items: (r.items ?? []).map((it) => ({
        quantity: it.quantity ?? 0,
        isExtra: Boolean(it.isExtra),
        service: it.service ? { category: it.service.category ?? null } : null,
      })),
    });

    const readyCount = countReadyVisibleContracts(r.contracts ?? [], requiredUnits);

    const contractsBadge =
      requiredUnits > 0 ? { requiredUnits, readyCount } : null;

    // estado fianza
    const depositStatus = deriveReservationDepositStatus({
      depositCents,
      depositHeld: r.depositHeld,
      paidDepositCents,
      payments: r.payments,
    });

    // nombres para UI (main item o fallback legacy)
    const legacyServiceName = r.service?.name ?? null;
    const legacyDurationMinutes = r.option?.durationMinutes ?? null;

    const serviceName = isPack
      ? legacyServiceName
      : (mainItem?.service?.name ?? legacyServiceName);

    const durationMinutes = isPack
      ? null
      : (mainItem?.option?.durationMinutes ?? legacyDurationMinutes);

    const pvpTotalCents = isPack
      ? grossCents
      : (r.items.length > 0 ? serviceTotalCents + extrasTotalCents : Number(r.basePriceCents ?? 0));

    const finalTotalCents = Number(r.totalPriceCents ?? Math.max(0, pvpTotalCents - totalDiscountCents));
    const totalToChargeCents = finalTotalCents + depositCents;
    const storeFlowStage = deriveStoreFlowStage(r.status, r.arrivalAt);
    const jetskiAssignments = buildReservationJetskiAssignments({
      reservationId: r.id,
      assignments: r.monitorRunAssignments,
      units: r.units,
    });
    
    return {
      id: r.id,
      status: r.status,
      storeFlowStage,
      arrivalAt: r.arrivalAt,
      formalizedAt: r.formalizedAt,
      activityDate: r.activityDate,
      scheduledTime: r.scheduledTime,
      companionsCount: r.companionsCount,
      customerName: r.customerName,
      customerCountry: r.customerCountry,

      quantity: mainItem?.quantity ?? r.quantity,
      pax: r.pax,
      isLicense: r.isLicense,

      serviceName,
      durationMinutes,
      channelName: r.channel?.name ?? null,

      contracts: r.contracts ?? [],
      contractsBadge,

      // ✅ nuevos totales por items (fuente de verdad UI)
      serviceTotalCents,
      extrasTotalCents,
      soldTotalCents,

      // legacy (por convivencia)
      basePriceCents: r.basePriceCents,
      totalPriceCents: r.totalPriceCents,
      commissionBaseCents: r.commissionBaseCents ?? 0,
      appliedCommissionMode: r.appliedCommissionMode ?? "PERCENT",
      appliedCommissionValue: r.appliedCommissionValue ?? 0,
      appliedCommissionPct: r.appliedCommissionPct ?? null,
      appliedCommissionCents: Number(r.appliedCommissionCents ?? 0),
      depositCents,
      pvpTotalCents,
      finalTotalCents,
      totalToChargeCents,
      customerDiscountCents: channelCustomerDiscountCents,
      autoDiscountCents: r.autoDiscountCents ?? 0,
      manualDiscountCents: r.manualDiscountCents ?? 0,
      promoterDiscountCents: promoterDisc,
      companyDiscountCents: companyDisc,
      manualDiscountReason: r.manualDiscountReason ?? null,

      paidCents,
      paidServiceCents,
      paidDepositCents,
      refundableDepositCents,

      pendingCents,
      pendingServiceCents,
      pendingDepositCents,

      depositStatus,
      depositHeld: r.depositHeld,
      depositHoldReason: r.depositHoldReason ?? null,

      source: r.source,
      boothCode: r.boothCode,
      boothNote: r.boothNote,
      arrivedStoreAt: r.arrivedStoreAt,

      taxiboatTripId: r.taxiboatTripId,
      taxiboatBoat: r.taxiboatTrip?.boat ?? null,
      taxiboatTripNo: r.taxiboatTrip?.tripNo ?? null,
      taxiboatDepartedAt: r.taxiboatTrip?.departedAt ?? null,
      jetskiAssignments,

      items: r.items.map((it) => ({
        id: it.id,
        isExtra: it.isExtra,
        serviceName: it.service?.name ?? null,
        durationMinutes: it.option?.durationMinutes ?? null,
        quantity: it.quantity,
        pax: it.pax,
        unitPriceCents: it.unitPriceCents,
        totalPriceCents: it.totalPriceCents,
        platformExtrasPendingCount: r.extraTimeEvents?.length ?? 0,
      })),

      extras: extras.map((it) => ({
        id: it.id,
        serviceName: it.service?.name ?? null,
        quantity: it.quantity,
        pax: it.pax,
        unitPriceCents: it.unitPriceCents,
        totalPriceCents: it.totalPriceCents,
      })),

      payments: r.payments,
    };
  });

  return NextResponse.json({ rows });
}
