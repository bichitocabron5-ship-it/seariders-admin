import type { Prisma } from "@prisma/client";

import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import {
  buildCapacityBlockingReservationWhere,
  buildReservationsCapacityUsages,
  isCapacityCategory,
  normalizeCapacityCategory,
  type ReservationCapacityUsage,
} from "@/lib/reservation-capacity";
import { getSlotConfigOrThrow, getSlotLimitOrThrow } from "@/lib/slot-config";
import { BUSINESS_TZ } from "@/lib/tz-business";

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hhmmInMadridFromUtc(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function ceilDiv(a: number, b: number) {
  return Math.floor((a + b - 1) / b);
}

type SlotCapacityRequestItem = {
  category: string | null | undefined;
  durationMinutes: number | null | undefined;
  quantity: number | null | undefined;
};

function buildUsageBySlot(args: {
  usages: readonly ReservationCapacityUsage[];
  interval: number;
  openMin: number;
}) {
  const usedByCategorySlot = new Map<string, Map<number, number>>();

  for (const usage of args.usages) {
    const scheduledTime = usage.scheduledTime ? new Date(usage.scheduledTime) : null;
    if (!scheduledTime) continue;

    const hm = hhmmInMadridFromUtc(scheduledTime);
    const minute = hhmmToMinutes(hm);
    const idx0 = Math.floor((minute - args.openMin) / args.interval);
    const duration = getOperationalDurationMinutes({
      category: usage.category,
      durationMinutes: usage.durationMinutes,
      quantity: usage.quantity,
    });
    const slots = Math.max(1, ceilDiv(duration, args.interval));
    const units = getOperationalCapacityUnits({
      category: usage.category,
      quantity: usage.quantity,
    });

    const categoryUsage = usedByCategorySlot.get(usage.category) ?? new Map<number, number>();
    for (let i = 0; i < slots; i++) {
      const idx = idx0 + i;
      categoryUsage.set(idx, (categoryUsage.get(idx) ?? 0) + units);
    }
    usedByCategorySlot.set(usage.category, categoryUsage);
  }

  return usedByCategorySlot;
}

function buildRequestedUsageBySlot(args: {
  items: readonly SlotCapacityRequestItem[];
  scheduledStartUtc: Date;
  interval: number;
  openMin: number;
  closeMin: number;
  openTime: string;
  closeTime: string;
}) {
  const requestedByCategorySlot = new Map<string, Map<number, number>>();
  const startHm = hhmmInMadridFromUtc(args.scheduledStartUtc);
  const startMin = hhmmToMinutes(startHm);

  if (startMin < args.openMin || startMin >= args.closeMin) {
    throw new Error(`Hora fuera de horario (${args.openTime}-${args.closeTime}).`);
  }

  const startIdx = Math.floor((startMin - args.openMin) / args.interval);

  for (const item of args.items) {
    const category = normalizeCapacityCategory(item.category);
    if (!isCapacityCategory(category)) continue;

    const quantity = Math.max(1, Number(item.quantity ?? 0) || 1);
    const operationalDurationMinutes = getOperationalDurationMinutes({
      category,
      durationMinutes: item.durationMinutes,
      quantity,
    });
    const slotsNeeded = Math.max(1, ceilDiv(Math.max(1, operationalDurationMinutes), args.interval));

    if (startMin + slotsNeeded * args.interval > args.closeMin) {
      throw new Error(
        `No caben ${operationalDurationMinutes} min seguidos dentro del horario (${args.openTime}-${args.closeTime}).`
      );
    }

    const requestedUnits = getOperationalCapacityUnits({
      category,
      quantity,
    });
    const categoryUsage = requestedByCategorySlot.get(category) ?? new Map<number, number>();

    for (let i = 0; i < slotsNeeded; i++) {
      const idx = startIdx + i;
      categoryUsage.set(idx, (categoryUsage.get(idx) ?? 0) + requestedUnits);
    }
    requestedByCategorySlot.set(category, categoryUsage);
  }

  return requestedByCategorySlot;
}

export async function assertSlotCapacityForItemsOrThrow(args: {
  tx: Prisma.TransactionClient;
  dateStartUtc: Date;
  dateEndExclusiveUtc: Date;
  scheduledStartUtc: Date;
  items: readonly SlotCapacityRequestItem[];
  excludeReservationId?: string;
}) {
  const { tx, dateStartUtc, dateEndExclusiveUtc, scheduledStartUtc } = args;

  const policy = await getSlotConfigOrThrow(tx);
  const interval = policy.intervalMinutes ?? 30;
  const openTime = policy.openTime ?? "09:00";
  const closeTime = policy.closeTime ?? "20:00";

  const openMin = hhmmToMinutes(openTime);
  const closeMin = hhmmToMinutes(closeTime);

  const requestedByCategorySlot = buildRequestedUsageBySlot({
    items: args.items,
    scheduledStartUtc,
    interval,
    openMin,
    closeMin,
    openTime,
    closeTime,
  });

  if (requestedByCategorySlot.size === 0) return;

  const limitByCategory = new Map<string, number>();
  for (const category of requestedByCategorySlot.keys()) {
    const limit = await getSlotLimitOrThrow(tx, category);
    limitByCategory.set(category, Number(limit.maxUnits ?? 0));
  }

  const existing = await tx.reservation.findMany({
    where: {
      ...buildCapacityBlockingReservationWhere({ requireScheduledTime: true }),
      activityDate: { gte: dateStartUtc, lt: dateEndExclusiveUtc },
      ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
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

  const existingUsages = buildReservationsCapacityUsages(existing, {
    defaultDurationMinutes: interval,
  });
  const usedByCategorySlot = buildUsageBySlot({ usages: existingUsages, interval, openMin });

  for (const [category, requestedBySlot] of requestedByCategorySlot) {
    const maxUnits = limitByCategory.get(category) ?? 0;
    const existingBySlot = usedByCategorySlot.get(category) ?? new Map<number, number>();

    for (const [idx, requestedUnits] of requestedBySlot) {
      const used = existingBySlot.get(idx) ?? 0;

      if (used + requestedUnits > maxUnits) {
        throw new Error(`Slot completo (${category}).`);
      }
    }
  }
}

export async function assertSlotCapacityOrThrow(args: {
  tx: Prisma.TransactionClient;
  dateStartUtc: Date;
  dateEndExclusiveUtc: Date;
  scheduledStartUtc: Date;
  category: string;
  durationMinutes: number;
  units: number;
  excludeReservationId?: string;
}) {
  return assertSlotCapacityForItemsOrThrow({
    tx: args.tx,
    dateStartUtc: args.dateStartUtc,
    dateEndExclusiveUtc: args.dateEndExclusiveUtc,
    scheduledStartUtc: args.scheduledStartUtc,
    items: [
      {
        category: args.category,
        durationMinutes: args.durationMinutes,
        quantity: args.units,
      },
    ],
    excludeReservationId: args.excludeReservationId,
  });
}
