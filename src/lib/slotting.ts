import { prisma } from "@/lib/prisma";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";

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
  const policy = await tx.slotPolicy.findFirst({ orderBy: { createdAt: "desc" } });
  return {
    intervalMinutes: policy?.intervalMinutes ?? 30,
    openTime: policy?.openTime ?? "09:00",
    closeTime: policy?.closeTime ?? "20:00",
  };
}

export async function getCategoryCapacity(category: string, tx = prisma): Promise<number> {
  const row = await tx.slotLimit.findUnique({ where: { category } });
  if (row?.maxUnits != null) return row.maxUnits;

  if (String(category).toUpperCase() === "JETSKI") return 10;
  return 1;
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

  const policy = await getSlotPolicy(tx);
  const intervalMin = policy.intervalMinutes;

  const operationalDurationMin = getOperationalDurationMinutes({
    category: args.category,
    durationMinutes: args.durationMin,
    quantity: args.quantity,
  });
  const slots = computeSlotsNeeded(operationalDurationMin, intervalMin);
  const end = computeEndFromSlots(args.scheduledStart, slots, intervalMin);

  const cap = await getCategoryCapacity(args.category, tx);
  const windowStart = new Date(args.scheduledStart.getTime() - 24 * 60 * 60_000);
  const windowEnd = new Date(end.getTime() + 24 * 60 * 60_000);

  const existing = await tx.reservation.findMany({
    where: {
      status: { notIn: ["CANCELED", "COMPLETED"] },
      scheduledTime: { not: null, gte: windowStart, lte: windowEnd },
      service: { category: args.category },
    },
    select: {
      id: true,
      quantity: true,
      scheduledTime: true,
      option: { select: { durationMinutes: true } },
    },
  });

  const toSlotIndex = (date: Date) => Math.floor(date.getTime() / (intervalMin * 60_000));

  const reqStartIdx = toSlotIndex(args.scheduledStart);
  const reqEndIdx = toSlotIndex(end);
  const usage = new Map<number, number>();

  for (const reservation of existing) {
    const scheduledTime = reservation.scheduledTime ? new Date(reservation.scheduledTime) : null;
    if (!scheduledTime) continue;

    const duration = getOperationalDurationMinutes({
      category: args.category,
      durationMinutes: Number(reservation.option?.durationMinutes ?? 0) || intervalMin,
      quantity: reservation.quantity ?? 1,
    });
    const reservationSlots = computeSlotsNeeded(duration, intervalMin);
    const reservationEnd = computeEndFromSlots(scheduledTime, reservationSlots, intervalMin);

    const startIdx = toSlotIndex(scheduledTime);
    const endIdx = toSlotIndex(reservationEnd);

    if (!(startIdx < reqEndIdx && endIdx > reqStartIdx)) continue;

    const units = getOperationalCapacityUnits({
      category: args.category,
      quantity: reservation.quantity ?? 1,
    });

    for (let i = Math.max(startIdx, reqStartIdx); i < Math.min(endIdx, reqEndIdx); i++) {
      usage.set(i, (usage.get(i) ?? 0) + units);
    }
  }

  const requestedUnits = getOperationalCapacityUnits({
    category: args.category,
    quantity: args.quantity,
  });

  for (let i = reqStartIdx; i < reqEndIdx; i++) {
    const total = (usage.get(i) ?? 0) + requestedUnits;
    if (total > cap) {
      throw new Error(`Sin disponibilidad: capacidad ${cap} excedida en ese horario (${args.category}).`);
    }
  }
}
