type ReservationActivitySummaryItem = {
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
  const mainItems = (reservation.items ?? []).filter(
    (item) =>
      !item.isExtra &&
      !item.isPackParent &&
      String(item.service?.category ?? "").trim().toUpperCase() !== "PACK"
  );

  if (mainItems.length === 0) {
    const hasPackParentItem = (reservation.items ?? []).some(
      (item) =>
        !item.isExtra &&
        (item.isPackParent ||
          String(item.service?.category ?? "").trim().toUpperCase() === "PACK")
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
