// src/app/api/store/reservations/today/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";
import { deriveStoreFlowStage } from "@/lib/store-flow-stage";

export const runtime = "nodejs";

export async function GET() {
  // ✅ App Router: cookies() + getIronSession(cookieStore)
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tz = process.env.BUSINESS_TZ || "Europe/Madrid";
  const { start, endExclusive } = tzDayRangeUtc(tz, new Date());

  const rowsDb = await prisma.reservation.findMany({
    where: {
      status: { in: ["WAITING", "READY_FOR_PLATFORM", "IN_SEA", "SCHEDULED"] },

      // ✅ clave: que esté formalizada
      formalizedAt: { not: null },

      // ✅ hoy = reservas con scheduledTime hoy, o si no tienen scheduledTime, activityDate hoy
      OR: [
        { scheduledTime: { gte: start, lt: endExclusive } },
        { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
      ],

      // y tu filtro de origen se queda igual:
      AND: [
        {
          OR: [
            { source: "STORE" },
            { source: "BOOTH", arrivedStoreAt: { not: null } },
          ],
        },
      ],
    },
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
      depositCents: true,
      isLicense: true,     
      autoDiscountCents: true,
      manualDiscountCents: true,
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
        select: { status: true, unitIndex: true },
      },

      depositHeld: true,
      depositHoldReason: true,
    },
  });

  const rows = rowsDb.map((r) => {
    // pagos netos
    const paidCents = r.payments.reduce((sum, p) => {
      const sign = p.direction === "OUT" ? -1 : 1;
      return sum + sign * p.amountCents;
    }, 0);

    const paidServiceCents = r.payments
      .filter((p) => !p.isDeposit)
      .reduce((sum, p) => {
        const sign = p.direction === "OUT" ? -1 : 1;
        return sum + sign * p.amountCents;
      }, 0);

    const paidDepositCents = r.payments
      .filter((p) => p.isDeposit)
      .reduce((sum, p) => {
        const sign = p.direction === "OUT" ? -1 : 1;
        return sum + sign * p.amountCents;
      }, 0);

    const refundableDepositCents = Math.max(0, paidDepositCents);
    const depositCents = computeReservationDepositCents({
      storedDepositCents: r.depositCents,
      quantity: r.quantity,
      isLicense: Boolean(r.isLicense),
      serviceCategory: r.service?.category ?? null,
      items: (r.items ?? []).map((item) => ({
        quantity: item.quantity ?? 0,
        isExtra: Boolean(item.isExtra),
        service: item.service ? { category: item.service.category ?? null } : null,
      })),
    });

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

    const isPack = Boolean(r.isPackParent && r.packId)
    const legacyGrossCents = Number(r.totalPriceCents ?? 0) + autoDisc + manualDisc;

    const grossCents = isPack
      ? Number(r.totalPriceCents ?? 0) // ✅ packs: el total está en el padre
      : (r.items.length > 0
          ? serviceTotalCents + extrasTotalCents
          : legacyGrossCents);

    const soldTotalCents = isPack
      ? Number(r.totalPriceCents ?? 0)
      : Math.max(0, grossCents - autoDisc - manualDisc);
 
    // pendientes separados (✅ servicio basado en items)
    const pendingServiceCents = Math.max(0, soldTotalCents - paidServiceCents);
    const pendingDepositCents = Math.max(0, depositCents - refundableDepositCents);
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

    const readyCount = (r.contracts ?? []).filter(
      (c) =>
        Number(c.unitIndex) >= 1 &&
        Number(c.unitIndex) <= requiredUnits &&
        (c.status === "READY" || c.status === "SIGNED")
    ).length;

    const contractsBadge =
      requiredUnits > 0 ? { requiredUnits, readyCount } : null;

    // estado fianza
    let depositStatus: "PENDIENTE" | "LIBERABLE" | "DEVUELTA" | "RETENIDA";
    if (r.depositHeld) {
      depositStatus = "RETENIDA";
    } else if (paidDepositCents <= 0) {
      const hadDepositIn = r.payments.some((p) => p.isDeposit && p.direction === "IN");
      const hadDepositOut = r.payments.some((p) => p.isDeposit && p.direction === "OUT");
      depositStatus = hadDepositIn && hadDepositOut ? "DEVUELTA" : "PENDIENTE";
    } else {
      depositStatus = "LIBERABLE";
    }

    // nombres para UI (main item o fallback legacy)
    const legacyServiceName = r.service?.name ?? null;
    const legacyDurationMinutes = r.option?.durationMinutes ?? null;

    const serviceName = isPack
      ? legacyServiceName
      : (mainItem?.service?.name ?? legacyServiceName);

    const durationMinutes = isPack
      ? null
      : (mainItem?.option?.durationMinutes ?? legacyDurationMinutes);

    const pvpFromReservation = legacyGrossCents;

    const pvpTotalCents = isPack
      ? pvpFromReservation
      : (r.items.length > 0 ? serviceTotalCents + extrasTotalCents : Number(r.basePriceCents ?? 0));

    const finalTotalCents = Number(r.totalPriceCents ?? pvpTotalCents);
    const storeFlowStage = deriveStoreFlowStage(r.status, r.arrivalAt);
    
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
      depositCents,
      pvpTotalCents,
      finalTotalCents,
      autoDiscountCents: r.autoDiscountCents ?? 0,
      manualDiscountCents: r.manualDiscountCents ?? 0,
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
function tzDayRangeUtc(tz: string, arg1: Date): { start: Date; endExclusive: Date } {
  const ymd = getYmdInTz(arg1, tz);

  const start = zonedTimeToUtc(ymd.y, ymd.m, ymd.d, 0, 0, 0, tz);

  const next = addDaysYmd(ymd.y, ymd.m, ymd.d, 1);
  const endExclusive = zonedTimeToUtc(next.y, next.m, next.d, 0, 0, 0, tz);

  return { start, endExclusive };
}

function getYmdInTz(date: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const s = fmt.format(date); // YYYY-MM-DD
  const [yy, mm, dd] = s.split("-").map(Number);
  return { y: yy, m: mm, d: dd };
}

function addDaysYmd(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tz: string
): Date {
  let utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));

  for (let i = 0; i < 2; i++) {
    const offsetMin = tzOffsetMinutes(utcGuess, tz);
    utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000);
  }

  return utcGuess;
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}
