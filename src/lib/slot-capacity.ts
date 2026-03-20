import { BUSINESS_TZ } from "@/lib/tz-business";
import type { Prisma } from "@prisma/client";

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
  dateStartUtc: Date;		// inicio del día (Madrid) en UTC
  dateEndExclusiveUtc: Date;	// fin exclusivo del día (Madrid) en UTC
  scheduledStartUtc: Date;	// hora de inicio (UTC)
  category: string;		// "JETSKI" | "BOAT" | "TOWABLE" | "JETCAR"
  durationMinutes: number;	// duración del option
  units: number;		// units = quantity
}) {

  const { tx, dateStartUtc, dateEndExclusiveUtc, scheduledStartUtc } = args;
  const category = String(args.category ?? "").toUpperCase();

  const limit = await tx.slotLimit.findUnique({
    where: { category },
    select: { maxUnits: true },
  });

  // si no hay limite configurado, no consumimos capacidad
  if (!limit) return;

  // 1) Policy
  const policy = await tx.slotPolicy.findFirst({ orderBy: { createdAt: "desc" } });
  const interval = policy?.intervalMinutes ?? 30;
  const openTime = policy?.openTime ?? "09:00";
  const closeTime = policy?.closeTime ?? "20:00";

  const openMin = hhmmToMinutes(openTime);
  const closeMin = hhmmToMinutes(closeTime);

  // 2) Limit por categor?a
  const maxUnits = Number(limit.maxUnits ?? 0);

  // 3) Índices de slot requeridos
  const startHm = hhmmInMadridFromUtc(scheduledStartUtc);
  const startMin = hhmmToMinutes(startHm);

  if (startMin < openMin || startMin >= closeMin) {
    throw new Error(`Hora fuera de horario (${openTime}–${closeTime}).`);
  }

  const slotsNeeded = Math.max(1, ceilDiv(Math.max(1, args.durationMinutes), interval));
  const startIdx = Math.floor((startMin - openMin) / interval);

  // 4) Traer reservas del día de esa categoría
  const existing = await tx.reservation.findMany({
    where: {
      source: "STORE",
      status: { not: "CANCELED" },
      scheduledTime: { not: null },
      activityDate: { gte: dateStartUtc, lt: dateEndExclusiveUtc },
      service: { category },
    },
    select: {
      scheduledTime: true,
      quantity: true,
      option: { select: { durationMinutes: true } },
    },
  });

  // 5) Construir uso por slot
  const usedByIdx = new Map<number, number>();

  for (const r of existing) {
    const st = r.scheduledTime ? new Date(r.scheduledTime) : null;
    if (!st) continue;

    const hm = hhmmInMadridFromUtc(st);
    const m = hhmmToMinutes(hm);
    const idx0 = Math.floor((m - openMin) / interval);

    const dur = Math.max(1, Number(r.option?.durationMinutes ?? interval));
    const rSlots = Math.max(1, ceilDiv(dur, interval));

    for (let i = 0; i < rSlots; i++) {
      const idx = idx0 + i;
      usedByIdx.set(idx, (usedByIdx.get(idx) ?? 0) + Math.max(1, Number(r.quantity ?? 1)));
    }
  }

  // 6) Validar que la nueva reserva cabe en todos los slots que ocupa
  const units = Math.max(1, Number(args.units ?? 1));

  for (let i = 0; i < slotsNeeded; i++) {
    const idx = startIdx + i;
    const used = usedByIdx.get(idx) ?? 0;

    if (used + units > maxUnits) {
      throw new Error(`Slot completo (${category}).`);
    }
  }
}
