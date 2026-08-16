import { getReservationActivityItems } from "@/lib/reservation-activity-summary";

type ReportingActivityItem = {
  quantity?: number | null;
  totalPriceCents?: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
  service?: { id?: string | null; name?: string | null; category?: string | null } | null;
};

type ReservationActivityMetricInput = {
  service?: { id?: string | null; name?: string | null; category?: string | null } | null;
  quantity?: number | null;
  items?: ReportingActivityItem[] | null;
  soldTotalCents: number;
  collectedCents: number;
  pendingCents: number;
};

export type ReservationActivityMetricLine = {
  serviceId: string | null;
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

function serviceName(
  service: { id?: string | null; name?: string | null; category?: string | null } | null | undefined
) {
  return service?.name ?? service?.category ?? "-";
}

function serviceKey(
  service: { id?: string | null; name?: string | null; category?: string | null } | null | undefined
) {
  const id = String(service?.id ?? "").trim();
  if (id) return `id:${id}`;
  return `fallback:${serviceName(service)}`;
}

export function allocateCentsByWeights(totalCents: number, weights: number[]) {
  const total = normalizedCents(totalCents);
  if (weights.length === 0) return [];

  const normalizedWeights = weights.map((weight) => {
    const parsed = Number(weight);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const weightSum = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    const base = Math.floor(total / weights.length);
    const remainder = total - base * weights.length;
    return weights.map((_, index) => base + (index < remainder ? 1 : 0));
  }

  const quotas = normalizedWeights.map((weight, index) => {
    const exact = (total * weight) / weightSum;
    const floor = Math.floor(exact);
    return { index, floor, fraction: exact - floor };
  });
  const allocations = quotas.map((quota) => quota.floor);
  const floorTotal = allocations.reduce((sum, value) => sum + value, 0);
  const remainder = Math.max(0, total - floorTotal);

  quotas
    .slice()
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, remainder)
    .forEach((quota) => {
      allocations[quota.index] += 1;
    });

  return allocations;
}

export function buildReservationActivityMetricLines(
  reservation: ReservationActivityMetricInput
): ReservationActivityMetricLine[] {
  const activityItems = getReservationActivityItems(reservation.items);

  if (activityItems.length === 0) {
    return [
      {
        serviceId: reservation.service?.id ?? null,
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
  const salesAllocations = allocateCentsByWeights(reservation.soldTotalCents, weights);
  const collectedAllocations = allocateCentsByWeights(reservation.collectedCents, weights);
  const pendingAllocations = allocateCentsByWeights(reservation.pendingCents, weights);

  const linesByService = new Map<string, ReservationActivityMetricLine>();

  activityItems.forEach((item, index) => {
    const key = serviceKey(item.service);
    const current =
      linesByService.get(key) ??
      {
        serviceId: item.service?.id ?? null,
        service: serviceName(item.service),
        reservations: 1,
        quantity: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      };

    current.quantity += positiveQuantity(item.quantity ?? null, 1);
    current.salesCents += salesAllocations[index] ?? 0;
    current.collectedCents += collectedAllocations[index] ?? 0;
    current.pendingCents += pendingAllocations[index] ?? 0;
    linesByService.set(key, current);
  });

  return Array.from(linesByService.values());
}

export function buildReservationActivityMetricRows(
  reservations: ReservationActivityMetricInput[]
) {
  const rowsByService = new Map<string, ReservationActivityMetricLine>();

  for (const reservation of reservations) {
    for (const line of buildReservationActivityMetricLines(reservation)) {
      const key = line.serviceId ? `id:${line.serviceId}` : `fallback:${line.service}`;
      const current =
        rowsByService.get(key) ??
        {
          serviceId: line.serviceId,
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
      rowsByService.set(key, current);
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
