import { JetskiLicenseMode, PricingTier } from "@prisma/client";

import { resolveJetskiLicenseMode, resolvePricingTierForJetskiMode } from "@/lib/jetski-license";

export type ReservationActivitySemanticLine = {
  serviceId?: string | null;
  optionId?: string | null;
  category?: string | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
};

const COMPAT_MAIN_CATEGORY_RANK: Record<string, number> = {
  JETSKI: 0,
  BOAT: 10,
  TAXIBOAT: 20,
  TOWABLE: 30,
  BANANA: 30,
};

function normalizeCategory(category: string | null | undefined) {
  const normalized = String(category ?? "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function compareNullableString(left: string | null | undefined, right: string | null | undefined) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function categoryRank(category: string | null | undefined) {
  const normalized = normalizeCategory(category);
  return normalized ? (COMPAT_MAIN_CATEGORY_RANK[normalized] ?? 100) : 100;
}

export function getReservationActivitySemanticLines<T extends ReservationActivitySemanticLine>(
  lines: T[]
): T[] {
  return lines.filter((line) => !line.isExtra && !line.isPackParent);
}

export function hasJetskiReservationActivity(lines: ReservationActivitySemanticLine[]) {
  return getReservationActivitySemanticLines(lines).some(
    (line) => normalizeCategory(line.category) === "JETSKI"
  );
}

export function selectReservationCompatMainLine<T extends ReservationActivitySemanticLine>(
  lines: T[]
): T | null {
  const candidates = getReservationActivitySemanticLines(lines);
  if (candidates.length === 0) return null;

  return candidates.slice().sort((left, right) => {
    const rankDelta = categoryRank(left.category) - categoryRank(right.category);
    if (rankDelta !== 0) return rankDelta;

    return (
      compareNullableString(normalizeCategory(left.category), normalizeCategory(right.category)) ||
      compareNullableString(left.serviceId, right.serviceId) ||
      compareNullableString(left.optionId, right.optionId)
    );
  })[0] ?? null;
}

export function deriveReservationItemSetCommercialCategory(
  lines: ReservationActivitySemanticLine[],
  fallbackCategory?: string | null
) {
  const activityLines = getReservationActivitySemanticLines(lines);
  if (hasJetskiReservationActivity(activityLines)) return "JETSKI";

  return normalizeCategory(selectReservationCompatMainLine(activityLines)?.category ?? fallbackCategory);
}

export function deriveReservationItemSetCommercialState(args: {
  lines: ReservationActivitySemanticLine[];
  jetskiLicenseMode?: JetskiLicenseMode | null;
  isLicense?: boolean | null;
  pricingTier?: PricingTier | null;
}) {
  const hasJetski = hasJetskiReservationActivity(args.lines);
  const jetskiLicenseMode = hasJetski
    ? resolveJetskiLicenseMode({
        category: "JETSKI",
        jetskiLicenseMode: args.jetskiLicenseMode,
        isLicense: args.isLicense,
      })
    : JetskiLicenseMode.NONE;

  return {
    jetskiLicenseMode,
    isLicense: hasJetski ? jetskiLicenseMode !== JetskiLicenseMode.NONE : Boolean(args.isLicense),
    pricingTier: hasJetski
      ? resolvePricingTierForJetskiMode(jetskiLicenseMode)
      : (args.pricingTier ?? PricingTier.STANDARD),
  };
}
