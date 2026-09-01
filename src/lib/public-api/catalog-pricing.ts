import { PricingTier } from "@prisma/client";

export type ActiveCatalogPrice = {
  serviceId: string;
  optionId: string | null;
  durationMin: number | null;
  pricingTier: PricingTier;
  basePriceCents: number | null;
};

export type CatalogPriceIndex = {
  standardByOption: Map<string, number>;
  standardByDuration: Map<string, number>;
  standardByService: Map<string, number>;
  residentByOption: Map<string, number>;
  residentByDuration: Map<string, number>;
  residentByService: Map<string, number>;
};

export type ActiveChannelOptionPrice = {
  optionId: string;
  priceCents: number | null;
  isActive: boolean;
};

function optionPriceKey(serviceId: string, optionId: string) {
  return `${serviceId}:${optionId}`;
}

function durationPriceKey(serviceId: string, durationMinutes: number) {
  return `${serviceId}:${durationMinutes}`;
}

function normalizePriceCents(value: number | null | undefined) {
  const cents = Number(value);
  return Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : null;
}

function rememberFirstPrice(map: Map<string, number>, key: string, value: number | null | undefined) {
  if (map.has(key)) return;

  const cents = normalizePriceCents(value);
  if (cents != null) map.set(key, cents);
}

export function buildActiveCatalogPriceIndex(prices: readonly ActiveCatalogPrice[]): CatalogPriceIndex {
  const index: CatalogPriceIndex = {
    standardByOption: new Map(),
    standardByDuration: new Map(),
    standardByService: new Map(),
    residentByOption: new Map(),
    residentByDuration: new Map(),
    residentByService: new Map(),
  };

  for (const price of prices) {
    const byOption = price.pricingTier === PricingTier.RESIDENT ? index.residentByOption : index.standardByOption;
    const byDuration =
      price.pricingTier === PricingTier.RESIDENT ? index.residentByDuration : index.standardByDuration;
    const byService = price.pricingTier === PricingTier.RESIDENT ? index.residentByService : index.standardByService;

    if (price.optionId) {
      rememberFirstPrice(byOption, optionPriceKey(price.serviceId, price.optionId), price.basePriceCents);
      continue;
    }

    rememberFirstPrice(byService, price.serviceId, price.basePriceCents);

    const durationMinutes = Number(price.durationMin ?? 0);
    if (durationMinutes > 0) {
      rememberFirstPrice(byDuration, durationPriceKey(price.serviceId, durationMinutes), price.basePriceCents);
    }
  }

  return index;
}

export function resolveCatalogOptionPriceCents(
  index: CatalogPriceIndex,
  option: { serviceId: string; id: string; durationMinutes?: number | null },
  pricingTier: PricingTier
) {
  const byOption = pricingTier === PricingTier.RESIDENT ? index.residentByOption : index.standardByOption;
  const byDuration = pricingTier === PricingTier.RESIDENT ? index.residentByDuration : index.standardByDuration;
  const optionPrice = byOption.get(optionPriceKey(option.serviceId, option.id));

  if (optionPrice != null) return optionPrice;

  const durationMinutes = Number(option.durationMinutes ?? 0);
  return durationMinutes > 0 ? (byDuration.get(durationPriceKey(option.serviceId, durationMinutes)) ?? null) : null;
}

export function resolvePublicOptionPriceCents(
  index: CatalogPriceIndex,
  option: { serviceId: string; id: string; durationMinutes?: number | null }
) {
  return resolveCatalogOptionPriceCents(index, option, PricingTier.STANDARD);
}

export function resolveCatalogServicePriceCents(
  index: CatalogPriceIndex,
  serviceId: string,
  pricingTier: PricingTier
) {
  const byService = pricingTier === PricingTier.RESIDENT ? index.residentByService : index.standardByService;
  return byService.get(serviceId) ?? null;
}

export function resolvePublicServicePriceCents(index: CatalogPriceIndex, serviceId: string) {
  return resolveCatalogServicePriceCents(index, serviceId, PricingTier.STANDARD);
}

export function buildActiveChannelOptionPriceIndex(prices: readonly ActiveChannelOptionPrice[]) {
  const index = new Map<string, number>();

  for (const price of prices) {
    if (!price.isActive || index.has(price.optionId)) continue;
    const cents = normalizePriceCents(price.priceCents);
    if (cents != null) index.set(price.optionId, cents);
  }

  return index;
}

export function resolvePublicWebOptionPriceCents(
  index: CatalogPriceIndex,
  webOptionPriceByOptionId: ReadonlyMap<string, number>,
  option: { serviceId: string; id: string; durationMinutes?: number | null }
) {
  const webPriceCents = webOptionPriceByOptionId.get(option.id);
  if (webPriceCents != null) return webPriceCents;

  return resolvePublicOptionPriceCents(index, option);
}
