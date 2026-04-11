type ReservationDepositItem = {
  quantity: number | null;
  isExtra?: boolean | null;
  service: { category: string | null } | null;
};

function countJetskiUnits(items: ReservationDepositItem[]) {
  return items
    .filter((item) => !item.isExtra && String(item.service?.category ?? "").toUpperCase() === "JETSKI")
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);
}

export function computeReservationDepositCents(params: {
  storedDepositCents?: number | null;
  quantity: number | null;
  isLicense: boolean;
  serviceCategory?: string | null;
  items?: ReservationDepositItem[];
}) {
  const stored = Math.max(0, Number(params.storedDepositCents ?? 0));
  if (stored > 0) return stored;

  const jetskiUnitsFromItems = countJetskiUnits(params.items ?? []);
  const fallbackUnits =
    jetskiUnitsFromItems > 0
      ? jetskiUnitsFromItems
      : String(params.serviceCategory ?? "").toUpperCase() === "JETSKI"
        ? Math.max(0, Number(params.quantity ?? 0))
        : 0;

  if (fallbackUnits <= 0) return stored;
  return (params.isLicense ? 50000 : 10000) * fallbackUnits;
}

export function computeDepositFromResolvedItems(params: {
  isLicense: boolean;
  resolvedItems: Array<{ category: string | null; quantity: number | null }>;
}) {
  const jetskiUnits = params.resolvedItems
    .filter((item) => String(item.category ?? "").toUpperCase() === "JETSKI")
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);

  if (jetskiUnits <= 0) return 0;
  return (params.isLicense ? 50000 : 10000) * jetskiUnits;
}
