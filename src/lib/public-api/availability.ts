import { prisma } from "@/lib/prisma";
import { buildCapacityBlockingReservationWhere } from "@/lib/reservation-capacity";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import { getSlotConfigOrThrow } from "@/lib/slot-config";
import {
  BUSINESS_TZ,
  utcDateFromYmdInTz,
  utcDateTimeFromYmdHmInTz,
} from "@/lib/tz-business";
import { PublicApiError } from "@/lib/public-api/http";
import { getStableOptionCode, getStableServiceCode } from "@/lib/public-api/catalog";

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmInMadridFromUtc(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

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
  const selectedCategory = String(params.selectedCategory ?? "").trim().toUpperCase() || null;
  const selectedDurationMinutes = Number(params.selectedDurationMinutes ?? 0);
  const selectedQuantity = Number(params.selectedQuantity ?? 0);

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

  const startMin = hmToMinutes(openTime);
  const endMin = hmToMinutes(closeTime);
  const slotTimes: string[] = [];
  for (let time = startMin; time < endMin; time += interval) slotTimes.push(minutesToHm(time));

  const usedBySlot: Array<Record<string, number>> = slotTimes.map(() => ({}));
  const noTime: Record<string, number> = {};

  const dayStartUtc = utcDateFromYmdInTz(BUSINESS_TZ, date);
  const nextDate = addDaysYmd(date, 1);
  const dayEndExclusiveUtc =
    utcDateTimeFromYmdHmInTz(BUSINESS_TZ, nextDate, "00:00") ??
    new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const items = await prisma.reservationItem.findMany({
    where: {
      isExtra: false,
      reservation: {
        ...buildCapacityBlockingReservationWhere({ requireScheduledTime: false }),
        activityDate: { gte: dayStartUtc, lt: dayEndExclusiveUtc },
      },
    },
    select: {
      quantity: true,
      service: { select: { category: true } },
      option: { select: { durationMinutes: true } },
      reservation: { select: { scheduledTime: true } },
    },
  });

  function pushUsage(args: { scheduledTime: Date | null; category: string; qty: number; durMinutes: number }) {
    const category = String(args.category ?? "UNKNOWN").toUpperCase();
    const qty = Math.max(1, Number(args.qty ?? 1));
    const operationalQty = getOperationalCapacityUnits({ category, quantity: qty });

    if (!args.scheduledTime) {
      noTime[category] = (noTime[category] ?? 0) + operationalQty;
      return;
    }

    const hhmm = hhmmInMadridFromUtc(args.scheduledTime);
    const start = hmToMinutes(hhmm);
    const duration = getOperationalDurationMinutes({
      category,
      durationMinutes: args.durMinutes ?? interval,
      quantity: qty,
    });
    const slotsNeeded = Math.max(1, Math.ceil(duration / interval));
    const startSlotMin = startMin + Math.floor((start - startMin) / interval) * interval;
    const startIdx = Math.floor((startSlotMin - startMin) / interval);

    for (let i = 0; i < slotsNeeded; i++) {
      const idx = startIdx + i;
      if (idx < 0 || idx >= slotTimes.length) continue;
      usedBySlot[idx][category] = (usedBySlot[idx][category] ?? 0) + operationalQty;
    }
  }

  for (const item of items) {
    pushUsage({
      scheduledTime: item.reservation?.scheduledTime ?? null,
      category: item.service?.category ?? "UNKNOWN",
      qty: Number(item.quantity ?? 1),
      durMinutes: Number(item.option?.durationMinutes ?? interval),
    });
  }

  const requestedOperationalDuration =
    selectedCategory && selectedDurationMinutes > 0 && selectedQuantity > 0
      ? getOperationalDurationMinutes({
          category: selectedCategory,
          durationMinutes: selectedDurationMinutes,
          quantity: selectedQuantity,
        })
      : null;
  const requestedOperationalUnits =
    selectedCategory && selectedQuantity > 0
      ? getOperationalCapacityUnits({
          category: selectedCategory,
          quantity: selectedQuantity,
        })
      : null;

  const slots = slotTimes.map((time, idx) => {
    const used = usedBySlot[idx];
    const free: Record<string, number> = {};
    const isFull: Record<string, boolean> = {};
    const isSelectable: Record<string, boolean> = {};

    for (const [category, maxUnits] of Object.entries(limits)) {
      const currentUsed = used[category] ?? 0;
      const currentFree = Math.max(0, maxUnits - currentUsed);
      free[category] = currentFree;
      isFull[category] = currentFree <= 0;

      if (
        selectedCategory === category &&
        requestedOperationalDuration !== null &&
        requestedOperationalUnits !== null
      ) {
        const slotsNeeded = Math.max(1, Math.ceil(requestedOperationalDuration / interval));
        const startMinute = startMin + idx * interval;
        const fitsInSchedule = startMinute + slotsNeeded * interval <= endMin;
        let fitsCapacity = fitsInSchedule;

        if (fitsCapacity) {
          for (let step = 0; step < slotsNeeded; step++) {
            const slotUsage = usedBySlot[idx + step]?.[category] ?? 0;
            if (slotUsage + requestedOperationalUnits > maxUnits) {
              fitsCapacity = false;
              break;
            }
          }
        }

        isSelectable[category] = fitsCapacity;
      } else {
        isSelectable[category] = !isFull[category];
      }
    }

    return { time, used, free, isFull, isSelectable };
  });

  return {
    ok: true,
    date,
    intervalMinutes: interval,
    openTime,
    closeTime,
    limits,
    slots,
    noTime,
  };
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
    throw new PublicApiError("INVALID_INPUT", 400, "serviceCode u optionCode no válidos.");
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
