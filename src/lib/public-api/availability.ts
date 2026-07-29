import { prisma } from "@/lib/prisma";
import {
  buildCapacityBlockingReservationWhere,
  buildReservationsCapacityUsages,
} from "@/lib/reservation-capacity";
import { buildAvailabilitySnapshotFromCapacityUsages } from "@/lib/availability-snapshot";
import { getSlotConfigOrThrow } from "@/lib/slot-config";
import {
  BUSINESS_TZ,
  utcDateFromYmdInTz,
  utcDateTimeFromYmdHmInTz,
} from "@/lib/tz-business";
import { PublicApiError } from "@/lib/public-api/http";
import { getStableOptionCode, getStableServiceCode } from "@/lib/public-api/catalog";

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function getAvailabilitySnapshot(params: {
  date: string;
  selectedCategory?: string | null;
  selectedDurationMinutes?: number;
  selectedQuantity?: number;
}) {
  const date = params.date;

  const policy = await getSlotConfigOrThrow(prisma);
  const interval = policy.intervalMinutes ?? 30;
  const openTime = policy.openTime ?? "09:00";
  const closeTime = policy.closeTime ?? "20:00";

  const limitsRows = await prisma.slotLimit.findMany({
    select: { category: true, maxUnits: true },
  });
  if (limitsRows.length === 0) {
    throw new Error("CONFIGURATION_REQUIRED: SlotLimit no configurado.");
  }

  const limits: Record<string, number> = {};
  for (const row of limitsRows) limits[String(row.category).toUpperCase()] = row.maxUnits;

  const dayStartUtc = utcDateFromYmdInTz(BUSINESS_TZ, date);
  const nextDate = addDaysYmd(date, 1);
  const dayEndExclusiveUtc =
    utcDateTimeFromYmdHmInTz(BUSINESS_TZ, nextDate, "00:00") ??
    new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      ...buildCapacityBlockingReservationWhere({ requireScheduledTime: false }),
      activityDate: { gte: dayStartUtc, lt: dayEndExclusiveUtc },
    },
    select: {
      id: true,
      scheduledTime: true,
      quantity: true,
      service: { select: { category: true } },
      option: { select: { durationMinutes: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          isExtra: true,
          isPackParent: true,
          service: { select: { category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
    },
  });

  const usages = buildReservationsCapacityUsages(reservations, {
    defaultDurationMinutes: interval,
  });

  return buildAvailabilitySnapshotFromCapacityUsages({
    date,
    intervalMinutes: interval,
    openTime,
    closeTime,
    limits,
    usages,
    selectedCategory: params.selectedCategory,
    selectedDurationMinutes: params.selectedDurationMinutes,
    selectedQuantity: params.selectedQuantity,
  });
}

export async function buildPublicAvailability(params: {
  serviceCode: string;
  optionCode: string;
  date: string;
  quantity?: number;
  time?: string | null;
}) {
  const quantity = Math.max(1, Number(params.quantity ?? 1));

  const option = await prisma.serviceOption.findFirst({
    where: {
      code: params.optionCode,
      isActive: true,
      service: {
        code: params.serviceCode,
        isActive: true,
      },
    },
    select: {
      code: true,
      durationMinutes: true,
      paxMax: true,
      service: {
        select: {
          code: true,
          name: true,
          category: true,
        },
      },
    },
  });

  if (!option?.service) {
    throw new PublicApiError("INVALID_INPUT", 400, "serviceCode u optionCode no validos.");
  }

  const serviceCode = getStableServiceCode({
    code: option.service.code ?? null,
    name: option.service.name,
    category: option.service.category,
  });
  const optionCode = getStableOptionCode({
    code: option.code ?? null,
    durationMinutes: option.durationMinutes ?? null,
    paxMax: option.paxMax ?? null,
    serviceCode,
  });

  const snapshot = await getAvailabilitySnapshot({
    date: params.date,
    selectedCategory: option.service.category,
    selectedDurationMinutes: Number(option.durationMinutes ?? 0),
    selectedQuantity: quantity,
  });

  const category = String(option.service.category ?? "").toUpperCase();
  const slots = snapshot.slots.map((slot) => ({
    time: slot.time,
    available: Boolean(slot.isSelectable[category]),
    freeUnits: Number(slot.free[category] ?? 0),
  }));

  if (params.time) {
    const exactSlot = slots.find((slot) => slot.time === params.time);
    if (!exactSlot || !exactSlot.available) {
      throw new PublicApiError("NO_AVAILABILITY", 404, "No hay disponibilidad para la hora solicitada.");
    }
  }

  return {
    service: {
      serviceCode,
      name: option.service.name,
      category: option.service.category,
    },
    option: {
      optionCode,
      durationMinutes: Number(option.durationMinutes ?? 0),
      paxMax: Number(option.paxMax ?? 0),
    },
    date: snapshot.date,
    intervalMinutes: snapshot.intervalMinutes,
    openTime: snapshot.openTime,
    closeTime: snapshot.closeTime,
    quantity,
    availableSlotCount: slots.filter((slot) => slot.available).length,
    slots,
  };
}
