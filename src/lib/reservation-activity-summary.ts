type ReservationActivitySummaryItem = {
  quantity?: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null; paxMax?: number | null } | null;
};

type ReservationActivitySummaryInput = {
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null; paxMax?: number | null } | null;
  items?: ReservationActivitySummaryItem[] | null;
};

function normalizeCategory(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function positiveQuantity(value: number | null | undefined) {
  const parsed = Math.trunc(Number(value ?? 0));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

export function isRealReservationActivityItem(item: ReservationActivitySummaryItem) {
  return (
    !item.isExtra &&
    !item.isPackParent &&
    normalizeCategory(item.service?.category ?? null) !== "PACK"
  );
}

export function getReservationActivityItems<T extends ReservationActivitySummaryItem>(
  items: T[] | null | undefined
) {
  return (items ?? []).filter(isRealReservationActivityItem);
}

export function sumReservationActivityQuantity(
  reservation: ReservationActivitySummaryInput & { quantity?: number | null }
) {
  const itemQuantity = getReservationActivityItems(reservation.items).reduce(
    (sum, item) => sum + positiveQuantity(item.quantity ?? null),
    0
  );

  if (itemQuantity > 0) return itemQuantity;
  return positiveQuantity(reservation.quantity ?? null);
}

export function sumReservationActivityQuantityForCategory(
  reservation: ReservationActivitySummaryInput & { quantity?: number | null },
  category: string | null | undefined
) {
  const expected = normalizeCategory(category);
  if (!expected) return 0;

  const activityItems = getReservationActivityItems(reservation.items);
  if (activityItems.length > 0) {
    return activityItems
      .filter((item) => normalizeCategory(item.service?.category ?? null) === expected)
      .reduce((sum, item) => sum + positiveQuantity(item.quantity ?? null), 0);
  }

  return normalizeCategory(reservation.service?.category ?? null) === expected
    ? positiveQuantity(reservation.quantity ?? null)
    : 0;
}

export function sumReservationJetskiQuantity(
  reservation: ReservationActivitySummaryInput & { quantity?: number | null }
) {
  return sumReservationActivityQuantityForCategory(reservation, "JETSKI");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
}

function positiveNumbers(values: Array<number | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

export function resolveReservationActivitySummary(
  reservation: ReservationActivitySummaryInput
) {
  const mainItems = getReservationActivityItems(reservation.items);

  if (mainItems.length === 0) {
    const hasPackParentItem = (reservation.items ?? []).some(
      (item) =>
        !item.isExtra &&
        (item.isPackParent ||
          normalizeCategory(item.service?.category ?? null) === "PACK")
    );

    return {
      serviceName: reservation.service?.name ?? null,
      serviceCategory: reservation.service?.category ?? null,
      durationMinutes: hasPackParentItem ? null : reservation.option?.durationMinutes ?? null,
      paxMax: hasPackParentItem ? null : reservation.option?.paxMax ?? null,
    };
  }

  const names = uniqueStrings(
    mainItems.map((item) => item.service?.name ?? item.service?.category ?? null)
  );
  const categories = uniqueStrings(mainItems.map((item) => item.service?.category ?? null));
  const durations = positiveNumbers(mainItems.map((item) => item.option?.durationMinutes ?? null));
  const paxMaxValues = positiveNumbers(mainItems.map((item) => item.option?.paxMax ?? null));

  return {
    serviceName: names.join(" + ") || reservation.service?.name || null,
    serviceCategory:
      categories.length === 1
        ? categories[0]
        : categories.join(" + ") || reservation.service?.category || null,
    durationMinutes: mainItems.length === 1 && durations.length === 1 ? durations[0] : null,
    paxMax: mainItems.length === 1 && paxMaxValues.length === 1 ? paxMaxValues[0] : null,
  };
}
