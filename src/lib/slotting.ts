import { prisma } from "@/lib/prisma";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import {
  buildCapacityBlockingReservationWhere,
  buildReservationsCapacityUsages,
  normalizeCapacityCategory,
} from "@/lib/reservation-capacity";
import { getSlotConfigOrThrow, getSlotLimitOrThrow } from "@/lib/slot-config";

type SlotPolicy = {
  intervalMinutes: number;
  openTime: string;
  closeTime: string;
};

function hhmmToMinutes(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function ceilDiv(a: number, b: number) {
  return Math.floor((a + b - 1) / b);
}

export async function getSlotPolicy(tx = prisma): Promise<SlotPolicy> {
  return await getSlotConfigOrThrow(tx);
}

export async function getCategoryCapacity(category: string, tx = prisma): Promise<number> {
  const row = await getSlotLimitOrThrow(tx, category);
  return row.maxUnits;
}

export function computeSlotsNeeded(durationMin: number, intervalMin: number) {
  return Math.max(1, ceilDiv(Math.max(1, durationMin), intervalMin));
}

export function computeEndFromSlots(start: Date, slots: number, intervalMin: number) {
  return new Date(start.getTime() + slots * intervalMin * 60_000);
}

export function assertTimeWithinBusinessHours(
  dateStr: string,
  timeStr: string,
  policy: SlotPolicy
) {
  const minute = hhmmToMinutes(timeStr);
  const open = hhmmToMinutes(policy.openTime);
  const close = hhmmToMinutes(policy.closeTime);

  if (minute < open || minute >= close) {
    throw new Error(`Hora fuera de horario (${policy.openTime}–${policy.closeTime}).`);
  }
}

export async function assertCapacityOrThrow(args: {
  category: string;
  durationMin: number;
  quantity: number;
  scheduledStart: Date;
  tx?: typeof prisma;
}) {
  const tx = args.tx ?? prisma;
  const category = normalizeCapacityCategory(args.category);

  const policy = await getSlotPolicy(tx);
  const intervalMin = policy.intervalMinutes;

  const operationalDurationMin = getOperationalDurationMinutes({
    category,
    durationMinutes: args.durationMin,
    quantity: args.quantity,
  });
  const slots = computeSlotsNeeded(operationalDurationMin, intervalMin);
  const end = computeEndFromSlots(args.scheduledStart, slots, intervalMin);

  const cap = await getCategoryCapacity(category, tx);
  const windowStart = new Date(args.scheduledStart.getTime() - 24 * 60 * 60_000);
  const windowEnd = new Date(end.getTime() + 24 * 60 * 60_000);

  const existing = await tx.reservation.findMany({
    where: {
      ...buildCapacityBlockingReservationWhere({ requireScheduledTime: true }),
      scheduledTime: { not: null, gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      quantity: true,
      scheduledTime: true,
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

  const toSlotIndex = (date: Date) => Math.floor(date.getTime() / (intervalMin * 60_000));

  const reqStartIdx = toSlotIndex(args.scheduledStart);
  const reqEndIdx = toSlotIndex(end);
  const slotUsage = new Map<number, number>();

  const existingUsages = buildReservationsCapacityUsages(existing, {
    defaultDurationMinutes: intervalMin,
  });

  for (const existingUsage of existingUsages) {
    if (existingUsage.category !== category) continue;

    const scheduledTime = existingUsage.scheduledTime ? new Date(existingUsage.scheduledTime) : null;
    if (!scheduledTime) continue;

    const duration = getOperationalDurationMinutes({
      category,
      durationMinutes: existingUsage.durationMinutes,
      quantity: existingUsage.quantity,
    });
    const reservationSlots = computeSlotsNeeded(duration, intervalMin);
    const reservationEnd = computeEndFromSlots(scheduledTime, reservationSlots, intervalMin);

    const startIdx = toSlotIndex(scheduledTime);
    const endIdx = toSlotIndex(reservationEnd);

    if (!(startIdx < reqEndIdx && endIdx > reqStartIdx)) continue;

    const units = getOperationalCapacityUnits({
      category,
      quantity: existingUsage.quantity,
    });

    for (let i = Math.max(startIdx, reqStartIdx); i < Math.min(endIdx, reqEndIdx); i++) {
      slotUsage.set(i, (slotUsage.get(i) ?? 0) + units);
    }
  }

  const requestedUnits = getOperationalCapacityUnits({
    category,
    quantity: args.quantity,
  });

  for (let i = reqStartIdx; i < reqEndIdx; i++) {
    const total = (slotUsage.get(i) ?? 0) + requestedUnits;
    if (total > cap) {
      throw new Error(`Sin disponibilidad: capacidad ${cap} excedida en ese horario (${args.category}).`);
    }
  }
}
