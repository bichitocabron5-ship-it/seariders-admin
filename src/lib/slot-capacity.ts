import type { Prisma } from "@prisma/client";

import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
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
  const { tx, dateStartUtc, dateEndExclusiveUtc, scheduledStartUtc } = args;
  const category = String(args.category ?? "").toUpperCase();

  const limit = await tx.slotLimit.findUnique({
    where: { category },
    select: { maxUnits: true },
  });

  if (!limit) return;

  const policy = await tx.slotPolicy.findFirst({ orderBy: { createdAt: "desc" } });
  const interval = policy?.intervalMinutes ?? 30;
  const openTime = policy?.openTime ?? "09:00";
  const closeTime = policy?.closeTime ?? "20:00";

  const openMin = hhmmToMinutes(openTime);
  const closeMin = hhmmToMinutes(closeTime);
  const maxUnits = Number(limit.maxUnits ?? 0);

  const startHm = hhmmInMadridFromUtc(scheduledStartUtc);
  const startMin = hhmmToMinutes(startHm);

  if (startMin < openMin || startMin >= closeMin) {
    throw new Error(`Hora fuera de horario (${openTime}–${closeTime}).`);
  }

  const operationalDurationMinutes = getOperationalDurationMinutes({
    category,
    durationMinutes: args.durationMinutes,
    quantity: args.units,
  });
  const slotsNeeded = Math.max(1, ceilDiv(Math.max(1, operationalDurationMinutes), interval));
  const startIdx = Math.floor((startMin - openMin) / interval);

  if (startMin + slotsNeeded * interval > closeMin) {
    throw new Error(
      `No caben ${operationalDurationMinutes} min seguidos dentro del horario (${openTime}–${closeTime}).`
    );
  }

  const existing = await tx.reservation.findMany({
    where: {
      source: "STORE",
      status: { not: "CANCELED" },
      scheduledTime: { not: null },
      activityDate: { gte: dateStartUtc, lt: dateEndExclusiveUtc },
      service: { category },
      ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
    },
    select: {
      scheduledTime: true,
      quantity: true,
      option: { select: { durationMinutes: true } },
    },
  });

  const usedByIdx = new Map<number, number>();

  for (const reservation of existing) {
    const scheduledTime = reservation.scheduledTime ? new Date(reservation.scheduledTime) : null;
    if (!scheduledTime) continue;

    const hm = hhmmInMadridFromUtc(scheduledTime);
    const minute = hhmmToMinutes(hm);
    const idx0 = Math.floor((minute - openMin) / interval);

    const duration = getOperationalDurationMinutes({
      category,
      durationMinutes: reservation.option?.durationMinutes ?? interval,
      quantity: reservation.quantity ?? 1,
    });
    const reservationSlots = Math.max(1, ceilDiv(duration, interval));
    const usedUnits = getOperationalCapacityUnits({
      category,
      quantity: reservation.quantity ?? 1,
    });

    for (let i = 0; i < reservationSlots; i++) {
      const idx = idx0 + i;
      usedByIdx.set(idx, (usedByIdx.get(idx) ?? 0) + usedUnits);
    }
  }

  const requestedUnits = getOperationalCapacityUnits({
    category,
    quantity: args.units ?? 1,
  });

  for (let i = 0; i < slotsNeeded; i++) {
    const idx = startIdx + i;
    const used = usedByIdx.get(idx) ?? 0;

    if (used + requestedUnits > maxUnits) {
      throw new Error(`Slot completo (${category}).`);
    }
  }
}
