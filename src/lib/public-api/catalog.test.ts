import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier } from "@prisma/client";

import {
  buildPublicCatalogSnapshotFromRows,
  isOptionVisibleForCatalogOrigin,
  isServiceVisibleForCatalogOrigin,
} from "./catalog";

const baseService = {
  category: "JETSKI",
  isExternalActivity: false,
  isLicense: false,
  isActive: true,
};

const baseOption = {
  durationMinutes: 30,
  paxMax: 2,
  contractedMinutes: 30,
  basePriceCents: 0,
  isActive: true,
};

test("catalog origin visibility keeps Store and Booth independent from WEB", () => {
  const service = {
    visibleInStore: true,
    visibleInBooth: false,
    visibleInWeb: false,
  };
  const option = {
    visibleInStore: false,
    visibleInBooth: true,
    visibleInWeb: false,
  };

  assert.equal(isServiceVisibleForCatalogOrigin("STORE", service), true);
  assert.equal(isServiceVisibleForCatalogOrigin("BOOTH", service), false);
  assert.equal(isServiceVisibleForCatalogOrigin("WEB", service), false);
  assert.equal(isOptionVisibleForCatalogOrigin("STORE", option), false);
  assert.equal(isOptionVisibleForCatalogOrigin("BOOTH", option), true);
  assert.equal(isOptionVisibleForCatalogOrigin("WEB", option), false);
});

function buildVisibilitySnapshot(args: { serviceVisibleInWeb: boolean; optionVisibleInWeb: boolean }) {
  return buildPublicCatalogSnapshotFromRows({
    generatedAt: "2026-09-01T10:00:00.000Z",
    webChannel: {
      id: "channel-web",
      code: "WEB",
      isActive: true,
      visibleInWeb: true,
    },
    servicesAll: [
      {
        ...baseService,
        id: "service-web-toggle",
        name: "Web Toggle",
        code: "WEB_TOGGLE",
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: args.serviceVisibleInWeb,
      },
    ],
    optionsRaw: [
      {
        ...baseOption,
        id: "option-web-toggle",
        serviceId: "service-web-toggle",
        code: "WEB_TOGGLE_30_2",
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: args.optionVisibleInWeb,
      },
    ],
    prices: [
      {
        serviceId: "service-web-toggle",
        optionId: "option-web-toggle",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 10_000,
      },
    ],
    webOptionPrices: [],
    serviceAllowedChannelRules: [],
  });
}

test("public catalog reflects visibleInWeb changes for services and options", () => {
  const visible = buildVisibilitySnapshot({
    serviceVisibleInWeb: true,
    optionVisibleInWeb: true,
  });
  assert.deepEqual(
    visible.services.map((service) => service.serviceCode),
    ["WEB_TOGGLE"]
  );
  assert.deepEqual(
    visible.services[0]?.options.map((option) => option.optionCode),
    ["WEB_TOGGLE_30_2"]
  );

  const hiddenService = buildVisibilitySnapshot({
    serviceVisibleInWeb: false,
    optionVisibleInWeb: true,
  });
  assert.deepEqual(hiddenService.services, []);

  const hiddenOption = buildVisibilitySnapshot({
    serviceVisibleInWeb: true,
    optionVisibleInWeb: false,
  });
  assert.deepEqual(hiddenOption.services[0]?.options, []);
  assert.equal(hiddenOption.services[0]?.startingPriceCents, null);
});

test("public catalog includes only WEB-enabled services and options with WEB effective prices", () => {
  const snapshot = buildPublicCatalogSnapshotFromRows({
    generatedAt: "2026-09-01T10:00:00.000Z",
    webChannel: {
      id: "channel-web",
      code: "WEB",
      isActive: true,
      visibleInWeb: true,
    },
    servicesAll: [
      {
        ...baseService,
        id: "service-store-only",
        name: "Store only",
        code: "STORE_ONLY",
        visibleInStore: true,
        visibleInBooth: false,
        visibleInWeb: false,
      },
      {
        ...baseService,
        id: "service-jetski",
        name: "Jetski",
        code: "JETSKI",
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      {
        ...baseService,
        id: "service-banana",
        name: "Banana Boat",
        code: "BANANA_BOAT",
        category: "BOAT",
        visibleInStore: false,
        visibleInBooth: false,
        visibleInWeb: true,
      },
      {
        ...baseService,
        id: "service-blocked",
        name: "Blocked Web",
        code: "BLOCKED_WEB",
        visibleInStore: false,
        visibleInBooth: false,
        visibleInWeb: true,
      },
    ],
    optionsRaw: [
      {
        ...baseOption,
        id: "option-store-only",
        serviceId: "service-store-only",
        code: "STORE_ONLY_30_2",
        visibleInStore: true,
        visibleInBooth: false,
        visibleInWeb: false,
      },
      {
        ...baseOption,
        id: "option-jetski-public",
        serviceId: "service-jetski",
        code: "JETSKI_30_2",
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      {
        ...baseOption,
        id: "option-jetski-hidden-web",
        serviceId: "service-jetski",
        code: "JETSKI_60_2",
        durationMinutes: 60,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: false,
      },
      {
        ...baseOption,
        id: "option-banana-public",
        serviceId: "service-banana",
        code: "BANANA_BOAT_30_2",
        visibleInStore: false,
        visibleInBooth: false,
        visibleInWeb: true,
      },
      {
        ...baseOption,
        id: "option-blocked",
        serviceId: "service-blocked",
        code: "BLOCKED_WEB_30_2",
        visibleInStore: false,
        visibleInBooth: false,
        visibleInWeb: true,
      },
    ],
    prices: [
      {
        serviceId: "service-store-only",
        optionId: "option-store-only",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 4_000,
      },
      {
        serviceId: "service-jetski",
        optionId: "option-jetski-public",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 10_000,
      },
      {
        serviceId: "service-jetski",
        optionId: "option-jetski-hidden-web",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 20_000,
      },
      {
        serviceId: "service-jetski",
        optionId: "option-jetski-public",
        durationMin: null,
        pricingTier: PricingTier.RESIDENT,
        basePriceCents: 5_000,
      },
      {
        serviceId: "service-banana",
        optionId: "option-banana-public",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 9_000,
      },
      {
        serviceId: "service-blocked",
        optionId: "option-blocked",
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 7_000,
      },
    ],
    webOptionPrices: [{ optionId: "option-jetski-public", priceCents: 12_000, isActive: true }],
    serviceAllowedChannelRules: [
      { serviceId: "service-blocked", channelId: "channel-store", active: true },
    ],
  });

  const serviceCodes = snapshot.services.map((service) => service.serviceCode);
  assert.deepEqual(serviceCodes, ["JETSKI", "BANANA_BOAT"]);

  const jetski = snapshot.services.find((service) => service.serviceCode === "JETSKI");
  assert.ok(jetski);
  assert.equal(jetski.startingPriceCents, 12_000);
  assert.deepEqual(
    jetski.options.map((option) => [option.optionCode, option.publicPriceCents]),
    [["JETSKI_30_2", 12_000]]
  );

  const banana = snapshot.services.find((service) => service.serviceCode === "BANANA_BOAT");
  assert.ok(banana);
  assert.equal(banana.startingPriceCents, 9_000);
  assert.deepEqual(
    banana.options.map((option) => [option.optionCode, option.publicPriceCents]),
    [["BANANA_BOAT_30_2", 9_000]]
  );
});

test("public catalog requires an active WEB channel with visibleInWeb", () => {
  assert.throws(
    () =>
      buildPublicCatalogSnapshotFromRows({
        webChannel: {
          id: "channel-web",
          code: "WEB",
          isActive: true,
          visibleInWeb: false,
        },
        servicesAll: [],
        optionsRaw: [],
        prices: [],
        webOptionPrices: [],
        serviceAllowedChannelRules: [],
      }),
    /Canal WEB no configurado/
  );
});
