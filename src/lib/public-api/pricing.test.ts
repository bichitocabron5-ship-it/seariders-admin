import assert from "node:assert/strict";
import test from "node:test";

import { JetskiLicenseMode, PricingTier } from "@prisma/client";

import { PublicApiError } from "./errors";
import {
  buildPublicQuoteWithDeps,
  type PublicQuoteDependencies,
} from "./pricing";

type ResolvePriceParams = Parameters<PublicQuoteDependencies["resolvePrice"]>[1];
type ComputeDiscountArgs = Parameters<PublicQuoteDependencies["computeAutoDiscount"]>[0];
type ListPromotionsArgs = Parameters<PublicQuoteDependencies["listPromotions"]>[0];

const validFrom = new Date("2026-06-01T00:00:00.000Z");

function promoOption(code: string, discountCents: number) {
  return {
    id: `promo-${code.toLowerCase()}`,
    name: `${code} promo`,
    code,
    scope: "OPTION" as const,
    kind: "FINAL_PRICE" as const,
    value: 8_000,
    requiresCountry: null,
    excludeCountry: null,
    countryScope: null,
    startTimeMin: null,
    endTimeMin: null,
    validFrom,
    validTo: null,
    discountCents,
  };
}

function appliedRule(code: string | null, name = "Automatic promo") {
  return {
    id: code ? `rule-${code.toLowerCase()}` : "rule-auto",
    name,
    code,
    scope: code ? ("OPTION" as const) : ("SERVICE" as const),
    kind: code ? ("FINAL_PRICE" as const) : ("PERCENT" as const),
    value: code ? 8_000 : 10,
    requiresCountry: null,
    excludeCountry: null,
    countryScope: null,
    startTimeMin: null,
    endTimeMin: null,
    validFrom,
    validTo: null,
  };
}

function makeQuoteFixture(config: {
  category?: string | null;
  allowsPromotions?: boolean;
  customerDiscountMode?: "PERCENT" | "FIXED" | null;
  customerDiscountValue?: number | null;
  customerDiscountCents?: number | null;
  unitPriceCents?: number;
  autoDiscountCents?: number;
  availablePromos?: ReturnType<typeof promoOption>[];
  noPrice?: boolean;
} = {}) {
  const resolvePriceParams: ResolvePriceParams[] = [];
  const computeDiscountArgs: ComputeDiscountArgs[] = [];
  const listPromotionsArgs: ListPromotionsArgs[] = [];

  const deps: PublicQuoteDependencies = {
    db: {} as PublicQuoteDependencies["db"],
    findCatalogOption: async () => ({
      option: {
        id: "option-web",
        code: "JETSKI_30_2",
        durationMinutes: 30,
        paxMax: 2,
        service: {
          id: "service-web",
          code: "JETSKI",
          name: "Jetski",
          category: config.category ?? "JETSKI",
          isLicense: false,
        },
      },
      webChannel: {
        id: "channel-web",
        code: "WEB",
        isActive: true,
        visibleInWeb: true,
        allowsPromotions: config.allowsPromotions ?? true,
        customerDiscountMode: config.customerDiscountMode ?? "PERCENT",
        customerDiscountValue: config.customerDiscountValue ?? 0,
        customerDiscountCents: config.customerDiscountCents ?? 0,
      },
    }),
    resolvePrice: async (_db, params) => {
      resolvePriceParams.push(params);
      if (config.noPrice) return null;
      const unitPriceCents = config.unitPriceCents ?? 10_000;

      return {
        servicePriceId: "service-price-web",
        adminPriceCents: unitPriceCents,
        effectivePriceCents: unitPriceCents,
        channelPriceApplied: false,
        pricingTier: params.pricingTier ?? PricingTier.STANDARD,
      };
    },
    computeAutoDiscount: async (args) => {
      computeDiscountArgs.push(args);
      if (args.promotionsEnabled === false) {
        return { discountCents: 0, rule: null };
      }

      const discountCents = config.autoDiscountCents ?? 0;
      return {
        discountCents,
        rule:
          discountCents > 0
            ? appliedRule(args.promoCode ? String(args.promoCode) : null)
            : null,
      };
    },
    listPromotions: async (args) => {
      listPromotionsArgs.push(args);
      if (args.promotionsEnabled === false) return [];
      return config.availablePromos ?? [];
    },
  };

  return { deps, resolvePriceParams, computeDiscountArgs, listPromotionsArgs };
}

const baseInput = {
  serviceCode: "JETSKI",
  optionCode: "JETSKI_30_2",
  quantity: 2,
  pax: 2,
  date: "2026-06-10",
  time: "11:00",
  customerCountry: "ES",
};

test("public quote applies automatic promotions when WEB allows promotions", async () => {
  const fixture = makeQuoteFixture({ autoDiscountCents: 1_500 });

  const quote = await buildPublicQuoteWithDeps(fixture.deps, baseInput);

  assert.equal(quote.baseTotalCents, 20_000);
  assert.equal(quote.autoDiscountCents, 1_500);
  assert.equal(quote.customerDiscountCents, 0);
  assert.equal(quote.discountCents, 1_500);
  assert.equal(quote.finalTotalCents, 18_500);
  assert.equal(fixture.computeDiscountArgs[0]?.promotionsEnabled, true);
  assert.equal(fixture.computeDiscountArgs[0]?.item.serviceId, "service-web");
  assert.equal(fixture.computeDiscountArgs[0]?.item.optionId, "option-web");
});

test("public quote does not apply promotions when WEB disallows promotions", async () => {
  const fixture = makeQuoteFixture({
    allowsPromotions: false,
    autoDiscountCents: 1_500,
  });

  const quote = await buildPublicQuoteWithDeps(fixture.deps, baseInput);

  assert.equal(quote.autoDiscountCents, 0);
  assert.equal(quote.discountCents, 0);
  assert.equal(quote.finalTotalCents, 20_000);
  assert.equal(fixture.listPromotionsArgs[0]?.promotionsEnabled, false);
  assert.equal(fixture.computeDiscountArgs[0]?.promotionsEnabled, false);
});

test("public quote validates promoCode against applicable WEB option promotions", async () => {
  const fixture = makeQuoteFixture({
    availablePromos: [promoOption("SUMMER", 4_000)],
    autoDiscountCents: 4_000,
  });

  const quote = await buildPublicQuoteWithDeps(fixture.deps, {
    ...baseInput,
    promoCode: " summer ",
  });

  assert.equal(fixture.computeDiscountArgs[0]?.promoCode, "SUMMER");
  assert.equal(quote.autoDiscountCents, 4_000);
  assert.equal(quote.appliedPromotion?.code, "SUMMER");
  assert.deepEqual(
    quote.availablePromotions.map((promo) => promo.code),
    ["SUMMER"]
  );
});

test("public quote rejects promoCode when it is not enabled for WEB", async () => {
  const fixture = makeQuoteFixture({
    allowsPromotions: false,
    availablePromos: [promoOption("SUMMER", 4_000)],
  });

  await assert.rejects(
    buildPublicQuoteWithDeps(fixture.deps, {
      ...baseInput,
      promoCode: "SUMMER",
    }),
    (error) =>
      error instanceof PublicApiError &&
      error.code === "PROMO_INVALID" &&
      error.status === 400
  );
  assert.equal(fixture.computeDiscountArgs.length, 0);
});

test("public quote includes WEB channel customer discounts in effective price", async () => {
  const fixture = makeQuoteFixture({
    customerDiscountMode: "PERCENT",
    customerDiscountValue: 10,
    autoDiscountCents: 500,
  });

  const quote = await buildPublicQuoteWithDeps(fixture.deps, baseInput);

  assert.equal(quote.baseTotalCents, 20_000);
  assert.equal(quote.customerDiscountCents, 2_000);
  assert.equal(quote.autoDiscountCents, 500);
  assert.equal(quote.discountCents, 2_500);
  assert.equal(quote.finalTotalCents, 17_500);
});

test("public quote applies resident tier only for GREEN_LIMITED jetski requests", async () => {
  const fixture = makeQuoteFixture();

  const quote = await buildPublicQuoteWithDeps(fixture.deps, {
    ...baseInput,
    jetskiLicenseMode: JetskiLicenseMode.GREEN_LIMITED,
  });

  assert.equal(fixture.resolvePriceParams[0]?.pricingTier, PricingTier.RESIDENT);
  assert.equal(quote.pricingTier, PricingTier.RESIDENT);
  assert.equal(quote.pricingMeta.modeLabel, "Tarifa residente / llave verde");
});

test("public quote ignores resident mode for non-jetski services", async () => {
  const fixture = makeQuoteFixture({ category: "TAXIBOAT" });

  const quote = await buildPublicQuoteWithDeps(fixture.deps, {
    ...baseInput,
    jetskiLicenseMode: JetskiLicenseMode.GREEN_LIMITED,
  });

  assert.equal(fixture.resolvePriceParams[0]?.pricingTier, PricingTier.STANDARD);
  assert.equal(quote.pricingTier, PricingTier.STANDARD);
});

test("public quote reports NO_PRICE when no active WEB price exists", async () => {
  const fixture = makeQuoteFixture({ noPrice: true });

  await assert.rejects(
    buildPublicQuoteWithDeps(fixture.deps, baseInput),
    (error) =>
      error instanceof PublicApiError &&
      error.code === "NO_PRICE" &&
      error.status === 404
  );
});
