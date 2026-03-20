import { prisma } from "@/lib/prisma";

type SlotPolicy = {
  intervalMinutes: number;
  openTime: string;  // "HH:mm"
  closeTime: string; // "HH:mm"
};

function hhmmToMinutes(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function ceilDiv(a: number, b: number) {
  return Math.floor((a + b - 1) / b);
}

export async function getSlotPolicy(tx = prisma): Promise<SlotPolicy> {
  const p = await tx.slotPolicy.findFirst({ orderBy: { createdAt: "desc" } });
  return {
    intervalMinutes: p?.intervalMinutes ?? 30,
    openTime: p?.openTime ?? "09:00",
    closeTime: p?.closeTime ?? "20:00",
  };
}

export async function getCategoryCapacity(category: string, tx = prisma): Promise<number> {
  const row = await tx.slotLimit.findUnique({ where: { category } });
  if (row?.maxUnits != null) return row.maxUnits;

  // defaults “duros” hasta que admin lo controle todo
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
  dateStr: string,           // "YYYY-MM-DD"
  timeStr: string,           // "HH:mm"
  policy: SlotPolicy
) {
  const t = hhmmToMinutes(timeStr);
  const open = hhmmToMinutes(policy.openTime);
  const close = hhmmToMinutes(policy.closeTime);

  // permitimos empezar hasta close-interval (si no, la actividad se sale)
  if (t < open || t >= close) {
    throw new Error(`Hora fuera de horario (${policy.openTime}–${policy.closeTime}).`);
  }
}

/**
 * Valida capacidad por solapamiento.
 *
 * Requiere:
 * - category (del service)
 * - durationMin (del option)
 * - quantity (units)
 * - scheduledStart (Date UTC)
 */
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

  const slots = computeSlotsNeeded(args.durationMin, intervalMin);
  const end = computeEndFromSlots(args.scheduledStart, slots, intervalMin);

  const cap = await getCategoryCapacity(args.category, tx);

  // Traemos reservas que potencialmente solapan (margen: mismo día y cercanas por hora).
  // Nota: como tú ya guardas activityDate a “mediodía UTC”, lo más estable es filtrar por rango de time.
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

  // Construimos consumo por “slot index” relativo al start del día (en minutos)
  // Para hacerlo simple y robusto: discretizamos por intervalMin sobre timestamps.
  const toSlotIndex = (d: Date) => Math.floor(d.getTime() / (intervalMin * 60_000));

  const reqStartIdx = toSlotIndex(args.scheduledStart);
  const reqEndIdx = toSlotIndex(end); // end es exclusivo en la práctica

  // acumulamos consumo por índice
  const usage = new Map<number, number>();

  for (const r of existing) {
    const st = r.scheduledTime ? new Date(r.scheduledTime) : null;
    if (!st) continue;

    const dur = Number(r.option?.durationMinutes ?? 0) || intervalMin;
    const slotsR = computeSlotsNeeded(dur, intervalMin);
    const endR = computeEndFromSlots(st, slotsR, intervalMin);

    const a = toSlotIndex(st);
    const b = toSlotIndex(endR);

    // solapa si (a < reqEnd && b > reqStart)
    if (!(a < reqEndIdx && b > reqStartIdx)) continue;

    for (let i = Math.max(a, reqStartIdx); i < Math.min(b, reqEndIdx); i++) {
      usage.set(i, (usage.get(i) ?? 0) + Number(r.quantity ?? 1));
    }
  }

  // añadimos la nueva reserva y validamos
  for (let i = reqStartIdx; i < reqEndIdx; i++) {
    const total = (usage.get(i) ?? 0) + args.quantity;
    if (total > cap) {
      throw new Error(`Sin disponibilidad: capacidad ${cap} excedida en ese horario (${args.category}).`);
    }
  }
}
