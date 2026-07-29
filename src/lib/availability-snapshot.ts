import type { ReservationCapacityUsage } from "@/lib/reservation-capacity";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import { BUSINESS_TZ } from "@/lib/tz-business";

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

export function buildAvailabilitySnapshotFromCapacityUsages(params: {
  date: string;
  intervalMinutes: number;
  openTime: string;
  closeTime: string;
  limits: Record<string, number>;
  usages: readonly ReservationCapacityUsage[];
  selectedCategory?: string | null;
  selectedDurationMinutes?: number;
  selectedQuantity?: number;
}) {
  const date = params.date;
  const interval = params.intervalMinutes ?? 30;
  const openTime = params.openTime ?? "09:00";
  const closeTime = params.closeTime ?? "20:00";
  const selectedCategory = String(params.selectedCategory ?? "").trim().toUpperCase() || null;
  const selectedDurationMinutes = Number(params.selectedDurationMinutes ?? 0);
  const selectedQuantity = Number(params.selectedQuantity ?? 0);

  const startMin = hmToMinutes(openTime);
  const endMin = hmToMinutes(closeTime);
  const slotTimes: string[] = [];
  for (let time = startMin; time < endMin; time += interval) slotTimes.push(minutesToHm(time));

  const usedBySlot: Array<Record<string, number>> = slotTimes.map(() => ({}));
  const noTime: Record<string, number> = {};

  function pushUsage(usage: ReservationCapacityUsage) {
    const category = String(usage.category ?? "UNKNOWN").toUpperCase();
    const quantity = Math.max(1, Number(usage.quantity ?? 1));
    const operationalQty = getOperationalCapacityUnits({ category, quantity });

    if (!usage.scheduledTime) {
      noTime[category] = (noTime[category] ?? 0) + operationalQty;
      return;
    }

    const hhmm = hhmmInMadridFromUtc(usage.scheduledTime);
    const start = hmToMinutes(hhmm);
    const duration = getOperationalDurationMinutes({
      category,
      durationMinutes: usage.durationMinutes ?? interval,
      quantity,
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

  for (const usage of params.usages) pushUsage(usage);

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

    for (const [category, maxUnits] of Object.entries(params.limits)) {
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
    limits: params.limits,
    slots,
    noTime,
  };
}
