import { prisma } from "@/lib/prisma";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export async function checkSlotCapacity(params: {
  date: string;
  time: string;
  category: string;
  quantity: number;
  durationMinutes: number;
}) {
  const { date, time, category, quantity, durationMinutes } = params;

  const policy = await prisma.slotPolicy.findFirst();
  if (!policy) throw new Error("SlotPolicy no configurado");

  const interval = policy.intervalMinutes;
  const openTime = policy.openTime;
  const closeTime = policy.closeTime;

  const limitRow = await prisma.slotLimit.findUnique({
    where: { category },
  });

  if (!limitRow) throw new Error(`SlotLimit no configurado para ${category}`);

  const maxUnits = limitRow.maxUnits;
  const startMin = hmToMinutes(openTime);
  const closeMin = hmToMinutes(closeTime);
  const timeMin = hmToMinutes(time);

  const operationalDurationMinutes = getOperationalDurationMinutes({
    category,
    durationMinutes,
    quantity,
  });
  const slotsNeeded = Math.ceil(operationalDurationMinutes / interval);
  const startSlotIndex = Math.floor((timeMin - startMin) / interval);

  if (timeMin + slotsNeeded * interval > closeMin) {
    return false;
  }

  const dayStartUtc = utcDateFromYmdInTz(BUSINESS_TZ, date);
  const nextDay = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      source: "STORE",
      activityDate: { gte: dayStartUtc, lt: nextDay },
      status: { not: "CANCELED" },
    },
    select: {
      scheduledTime: true,
      quantity: true,
      service: { select: { category: true } },
      option: { select: { durationMinutes: true } },
    },
  });

  const usedPerSlot: Record<number, number> = {};

  for (const reservation of reservations) {
    if (!reservation.scheduledTime) continue;
    if (reservation.service?.category !== category) continue;

    const hhmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(reservation.scheduledTime);

    const reservationStartMin = hmToMinutes(hhmm);
    const reservationSlots = Math.ceil(
      getOperationalDurationMinutes({
        category,
        durationMinutes: reservation.option?.durationMinutes ?? interval,
        quantity: reservation.quantity ?? 1,
      }) / interval
    );
    const reservationStartIdx = Math.floor((reservationStartMin - startMin) / interval);
    const reservationUnits = getOperationalCapacityUnits({
      category,
      quantity: reservation.quantity ?? 1,
    });

    for (let i = 0; i < reservationSlots; i++) {
      const idx = reservationStartIdx + i;
      usedPerSlot[idx] = (usedPerSlot[idx] ?? 0) + reservationUnits;
    }
  }

  const requestedUnits = getOperationalCapacityUnits({ category, quantity });

  for (let i = 0; i < slotsNeeded; i++) {
    const idx = startSlotIndex + i;
    const used = usedPerSlot[idx] ?? 0;

    if (used + requestedUnits > maxUnits) {
      return false;
    }
  }

  return true;
}
