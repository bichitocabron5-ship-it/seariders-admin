import { getReservationActivityItems } from "@/lib/reservation-activity-summary";

type ReportingActivityItem = {
  quantity?: number | null;
  totalPriceCents?: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
  service?: { name?: string | null; category?: string | null } | null;
};

type ReservationActivityMetricInput = {
  service?: { name?: string | null; category?: string | null } | null;
  quantity?: number | null;
  items?: ReportingActivityItem[] | null;
  soldTotalCents: number;
  collectedCents: number;
  pendingCents: number;
};

export type ReservationActivityMetricLine = {
  service: string;
  reservations: number;
  quantity: number;
  salesCents: number;
  collectedCents: number;
  pendingCents: number;
};

function normalizedCents(value: number | null | undefined) {
  const parsed = Math.round(Number(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function positiveQuantity(value: number | null | undefined, fallback: number) {
  const parsed = Math.trunc(Number(value ?? 0));
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(1, Math.trunc(fallback));
  return parsed;
}

function allocateByWeights(totalCents: number, weights: number[]) {
  const total = normalizedCents(totalCents);
  if (weights.length === 0) return [];

  const normalizedWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const weightSum = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    const base = Math.floor(total / weights.length);
    const remainder = total - base * weights.length;
    return weights.map((_, index) => base + (index < remainder ? 1 : 0));
  }

  let allocated = 0;
  return normalizedWeights.map((weight, index) => {
    if (index === normalizedWeights.length - 1) return total - allocated;
    const share = Math.round((total * weight) / weightSum);
    allocated += share;
    return share;
  });
}

export function buildReservationActivityMetricLines(
  reservation: ReservationActivityMetricInput
): ReservationActivityMetricLine[] {
  const activityItems = getReservationActivityItems(reservation.items);

  if (activityItems.length === 0) {
    return [
      {
        service: reservation.service?.name ?? "-",
        reservations: 1,
        quantity: positiveQuantity(reservation.quantity ?? null, 1),
        salesCents: normalizedCents(reservation.soldTotalCents),
        collectedCents: normalizedCents(reservation.collectedCents),
        pendingCents: normalizedCents(reservation.pendingCents),
      },
    ];
  }

  const weights = activityItems.map((item) => {
    const itemTotal = normalizedCents(item.totalPriceCents ?? null);
    return itemTotal > 0 ? itemTotal : positiveQuantity(item.quantity ?? null, 1);
  });
  const salesAllocations = allocateByWeights(reservation.soldTotalCents, weights);
  const collectedAllocations = allocateByWeights(reservation.collectedCents, weights);
  const pendingAllocations = allocateByWeights(reservation.pendingCents, weights);

  return activityItems.map((item, index) => ({
    service: item.service?.name ?? item.service?.category ?? "-",
    reservations: 1,
    quantity: positiveQuantity(item.quantity ?? null, 1),
    salesCents: salesAllocations[index] ?? 0,
    collectedCents: collectedAllocations[index] ?? 0,
    pendingCents: pendingAllocations[index] ?? 0,
  }));
}

export function buildReservationActivityMetricRows(
  reservations: ReservationActivityMetricInput[]
) {
  const rowsByService = new Map<string, ReservationActivityMetricLine>();

  for (const reservation of reservations) {
    for (const line of buildReservationActivityMetricLines(reservation)) {
      const current =
        rowsByService.get(line.service) ??
        {
          service: line.service,
          reservations: 0,
          quantity: 0,
          salesCents: 0,
          collectedCents: 0,
          pendingCents: 0,
        };
      current.reservations += line.reservations;
      current.quantity += line.quantity;
      current.salesCents += line.salesCents;
      current.collectedCents += line.collectedCents;
      current.pendingCents += line.pendingCents;
      rowsByService.set(line.service, current);
    }
  }

  return Array.from(rowsByService.values())
    .map((entry) => ({
      ...entry,
      averageTicketCents:
        entry.reservations > 0 ? Math.round(entry.salesCents / entry.reservations) : 0,
    }))
    .sort((a, b) => b.salesCents - a.salesCents);
}
