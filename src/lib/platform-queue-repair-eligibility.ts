export type PlatformQueueRepairScope = {
  kind: "JETSKI" | "NAUTICA" | null;
  categories: string[] | null;
};

export type PlatformQueueRepairCandidate = {
  service?: { category?: string | null } | null;
  items?: Array<{
    isExtra?: boolean | null;
    isPackParent?: boolean | null;
    service?: { category?: string | null } | null;
  }> | null;
  units?: Array<{
    status?: string | null;
    serviceCategory?: string | null;
  }> | null;
};

function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

function scopeHasCategoryFilter(scope: PlatformQueueRepairScope) {
  return Boolean(scope.kind || scope.categories?.length);
}

export function categoryMatchesPlatformQueueRepairScope(
  category: string | null | undefined,
  scope: PlatformQueueRepairScope
) {
  if (!scopeHasCategoryFilter(scope)) return true;

  const normalized = normalizeCategory(category);
  const categories = (scope.categories ?? [])
    .map((entry) => normalizeCategory(entry))
    .filter(Boolean);

  if (categories.length > 0) {
    return Boolean(normalized) && categories.includes(normalized);
  }

  if (scope.kind === "JETSKI") return normalized === "JETSKI";
  if (scope.kind === "NAUTICA") return Boolean(normalized) && normalized !== "JETSKI";

  return true;
}

function isRealReservationItem(
  item: NonNullable<PlatformQueueRepairCandidate["items"]>[number]
) {
  return !item.isExtra && !item.isPackParent;
}

function isRelevantReservationUnit(
  unit: NonNullable<PlatformQueueRepairCandidate["units"]>[number]
) {
  return String(unit.status ?? "").toUpperCase() !== "CANCELED";
}

export function isReservationEligibleForPlatformQueueRepairScope(
  reservation: PlatformQueueRepairCandidate,
  scope: PlatformQueueRepairScope
) {
  if (!scopeHasCategoryFilter(scope)) return true;

  const realItems = (reservation.items ?? []).filter(isRealReservationItem);
  if (realItems.length > 0) {
    return realItems.some((item) =>
      categoryMatchesPlatformQueueRepairScope(item.service?.category ?? null, scope)
    );
  }

  const relevantUnits = (reservation.units ?? []).filter(isRelevantReservationUnit);
  const unitsWithCategory = relevantUnits.filter((unit) =>
    Boolean(normalizeCategory(unit.serviceCategory))
  );

  if (unitsWithCategory.length > 0) {
    return unitsWithCategory.some((unit) =>
      categoryMatchesPlatformQueueRepairScope(unit.serviceCategory ?? null, scope)
    );
  }

  return categoryMatchesPlatformQueueRepairScope(reservation.service?.category ?? null, scope);
}
