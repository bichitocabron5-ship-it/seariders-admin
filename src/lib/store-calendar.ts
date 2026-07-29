import {
  buildReservationCapacityUsages,
  type ReservationCapacityReservationLike,
} from "@/lib/reservation-capacity";

type CalendarItemLike = {
  id?: string | null;
  quantity?: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null; paxMax?: number | null } | null;
};

export type CalendarReservationSummaryLike = Omit<
  ReservationCapacityReservationLike,
  "service" | "option" | "items"
> & {
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null; paxMax?: number | null } | null;
  items?: CalendarItemLike[] | null;
};

export type StoreCalendarReservationSummary = {
  service: { name: string; category: string | null } | null;
  option: { durationMinutes: number | null; paxMax: number | null } | null;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

export function resolveStoreCalendarReservationSummary(
  reservation: CalendarReservationSummaryLike
): StoreCalendarReservationSummary {
  const items = reservation.items ?? [];
  const usages = buildReservationCapacityUsages(reservation);

  if (items.length === 0 || usages.length === 0) {
    return {
      service: reservation.service
        ? {
            name: reservation.service.name ?? "Servicio",
            category: reservation.service.category ?? null,
          }
        : null,
      option: reservation.option
        ? {
            durationMinutes: reservation.option.durationMinutes ?? null,
            paxMax: reservation.option.paxMax ?? null,
          }
        : null,
    };
  }

  const capacityItemIds = new Set(
    usages.flatMap((usage) => usage.reservationItemId ? [usage.reservationItemId] : [])
  );
  const capacityItems = items.filter((item) => {
    if (item.isExtra || item.isPackParent) return false;
    const category = String(item.service?.category ?? "").trim().toUpperCase();
    return usages.some((usage) => usage.category === category) && (
      capacityItemIds.size === 0 || !item.id || capacityItemIds.has(item.id)
    );
  });
  const sourceItems = capacityItems.length > 0 ? capacityItems : items.filter((item) => !item.isExtra && !item.isPackParent);

  const categories = uniqueValues(sourceItems.map((item) => item.service?.category ?? null));
  const names = uniqueValues(sourceItems.map((item) => item.service?.name ?? item.service?.category ?? null));
  const durations = uniqueNumbers(sourceItems.map((item) => item.option?.durationMinutes ?? null));
  const paxMaxValues = uniqueNumbers(sourceItems.map((item) => item.option?.paxMax ?? null));

  return {
    service: {
      name: names.length > 0 ? names.join(" + ") : reservation.service?.name ?? "Servicio",
      category: categories.length === 1 ? categories[0] : categories.join(" + ") || reservation.service?.category || null,
    },
    option: {
      durationMinutes: durations.length === 1 ? durations[0] : null,
      paxMax: paxMaxValues.length === 1 ? paxMaxValues[0] : null,
    },
  };
}
