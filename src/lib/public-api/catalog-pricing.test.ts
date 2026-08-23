import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier } from "@prisma/client";

import {
  buildActiveCatalogPriceIndex,
  resolveCatalogOptionPriceCents,
  resolvePublicOptionPriceCents,
  resolvePublicServicePriceCents,
  type ActiveCatalogPrice,
} from "./catalog-pricing";

const option = {
  serviceId: "service-jetski",
  id: "option-30",
  durationMinutes: 30,
};

function indexFrom(prices: ActiveCatalogPrice[]) {
  return buildActiveCatalogPriceIndex(prices);
}

test("public catalog option price uses STANDARD option price before duration price", () => {
  const index = indexFrom([
    {
      serviceId: "service-jetski",
      optionId: null,
      durationMin: 30,
      pricingTier: PricingTier.STANDARD,
      basePriceCents: 5_900,
    },
    {
      serviceId: "service-jetski",
      optionId: "option-30",
      durationMin: null,
      pricingTier: PricingTier.STANDARD,
      basePriceCents: 6_900,
    },
  ]);

  assert.equal(resolvePublicOptionPriceCents(index, option), 6_900);
});

test("public catalog option price falls back to STANDARD duration price", () => {
  const index = indexFrom([
    {
      serviceId: "service-jetski",
      optionId: null,
      durationMin: 30,
      pricingTier: PricingTier.STANDARD,
      basePriceCents: 5_900,
    },
  ]);

  assert.equal(resolvePublicOptionPriceCents(index, option), 5_900);
});

test("public catalog option price ignores RESIDENT prices", () => {
  const index = indexFrom([
    {
      serviceId: "service-jetski",
      optionId: "option-30",
      durationMin: null,
      pricingTier: PricingTier.RESIDENT,
      basePriceCents: 4_900,
    },
  ]);

  assert.equal(resolvePublicOptionPriceCents(index, option), null);
  assert.equal(resolveCatalogOptionPriceCents(index, option, PricingTier.RESIDENT), 4_900);
});

test("public catalog service price uses standalone STANDARD service price", () => {
  const index = indexFrom([
    {
      serviceId: "service-gopro",
      optionId: null,
      durationMin: null,
      pricingTier: PricingTier.STANDARD,
      basePriceCents: 2_500,
    },
  ]);

  assert.equal(resolvePublicServicePriceCents(index, "service-gopro"), 2_500);
});
