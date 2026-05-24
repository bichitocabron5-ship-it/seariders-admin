import { getOperationalDurationMinutes, getOperationalPlatformUnits, usesQuantityAsOperationalMultiplier } from "@/lib/reservation-operations";

type ReservationUnitItemInput = {
  id?: string | null;
  quantity: number | null;
  pax: number | null;
  isExtra: boolean;
  service: {
    id?: string | null;
    name?: string | null;
    category: string | null;
  } | null;
  option: {
    id?: string | null;
    durationMinutes: number | null;
  } | null;
};

type ReservationUnitFallbackInput = {
  quantity: number | null;
  pax: number | null;
  service: {
    id?: string | null;
    name?: string | null;
    category: string | null;
  } | null;
  option: {
    id?: string | null;
    durationMinutes: number | null;
  } | null;
};

export type OperationalUnitSnapshot = {
  unitIndex: number;
  reservationItemId: string | null;
  serviceId: string | null;
  optionId: string | null;
  serviceCategory: string | null;
  serviceName: string | null;
  durationMinutesSnapshot: number | null;
  quantitySnapshot: number;
  paxSnapshot: number;
};

function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase() || null;
}

export function buildOperationalUnitSnapshots(args: {
  items: ReservationUnitItemInput[];
  fallback: ReservationUnitFallbackInput;
}) {
  const mainItems = args.items.filter((item) => !item.isExtra);
  const sourceItems =
    mainItems.length > 0
      ? mainItems
      : [
          {
            quantity: args.fallback.quantity,
            pax: args.fallback.pax,
            isExtra: false,
            service: args.fallback.service,
            option: args.fallback.option,
          },
        ];

  const units: OperationalUnitSnapshot[] = [];
  let unitIndex = 1;

  for (const item of sourceItems) {
    const category = normalizeCategory(item.service?.category);
    if (!category || getOperationalPlatformUnits({ category, quantity: item.quantity ?? 0 }) <= 0) {
      continue;
    }

    const itemQuantity = Math.max(1, Number(item.quantity ?? 0) || 1);
    const itemPax = Math.max(1, Number(item.pax ?? 0) || 1);
    const durationMinutes = Number(item.option?.durationMinutes ?? 0) || null;
    const platformUnits = getOperationalPlatformUnits({
      category,
      quantity: itemQuantity,
    });

    const baseSnapshot = {
      reservationItemId: item.id ?? null,
      serviceId: item.service?.id ?? null,
      optionId: item.option?.id ?? null,
      serviceCategory: category,
      serviceName: item.service?.name?.trim() || null,
      durationMinutesSnapshot: durationMinutes,
      paxSnapshot: itemPax,
    };

    if (usesQuantityAsOperationalMultiplier(category)) {
      units.push({
        unitIndex: unitIndex++,
        ...baseSnapshot,
        quantitySnapshot: itemQuantity,
        durationMinutesSnapshot: getOperationalDurationMinutes({
          category,
          durationMinutes,
          quantity: itemQuantity,
        }),
      });
      continue;
    }

    for (let index = 0; index < platformUnits; index++) {
      units.push({
        unitIndex: unitIndex++,
        ...baseSnapshot,
        quantitySnapshot: 1,
      });
    }
  }

  return units;
}
