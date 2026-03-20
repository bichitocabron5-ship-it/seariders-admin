import { prisma } from "@/lib/prisma";
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

  const limitRow = await prisma.slotLimit.findUnique({
    where: { category },
  });

  if (!limitRow) throw new Error(`SlotLimit no configurado para ${category}`);

  const maxUnits = limitRow.maxUnits;

  const startMin = hmToMinutes(openTime);
  const timeMin = hmToMinutes(time);

  const slotsNeeded = Math.ceil(durationMinutes / interval);
  const startSlotIndex = Math.floor((timeMin - startMin) / interval);

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

  for (const r of reservations) {
    if (!r.scheduledTime) continue;
    if (r.service?.category !== category) continue;

    const hhmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(r.scheduledTime);

    const rStartMin = hmToMinutes(hhmm);
    const rSlots = Math.ceil((r.option?.durationMinutes ?? interval) / interval);
    const rStartIdx = Math.floor((rStartMin - startMin) / interval);

    for (let i = 0; i < rSlots; i++) {
      const idx = rStartIdx + i;
      usedPerSlot[idx] = (usedPerSlot[idx] ?? 0) + (r.quantity ?? 1);
    }
  }

  for (let i = 0; i < slotsNeeded; i++) {
    const idx = startSlotIndex + i;
    const used = usedPerSlot[idx] ?? 0;

    if (used + quantity > maxUnits) {
      return false;
    }
  }

  return true;
}
