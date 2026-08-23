import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier, Prisma } from "@prisma/client";

import {
  buildStoreDiscountPreview,
  type StoreDiscountPreviewReader,
} from "./store-discount-preview";

type ServicePriceRow = {
  id: string | null;
  serviceId: string;
  optionId: string;
  basePriceCents: number;
  pricingTier?: PricingTier;
};

type ChannelOptionPriceRow = {
  channelId: string;
  optionId: string;
  priceCents: number;
  isActive?: boolean;
};

type QueryWithWhere = {
  where?: {
    id?: string;
    serviceId?: string;
    optionId?: string | null;
    pricingTier?: PricingTier;
    channelId_optionId?: {
      channelId?: string;
      optionId?: string;
    };
  };
};

function queryWhere(query: unknown) {
  return (query as QueryWithWhere).where;
}

function missingChannelOptionPriceTableError() {
  return new Prisma.PrismaClientKnownRequestError("ChannelOptionPrice table missing", {
    code: "P2021",
    clientVersion: "test",
    meta: { modelName: "ChannelOptionPrice" },
  });
}

function makePreviewFixture(config: {
  servicePrice?: ServicePriceRow | null;
  channelOptionPrices?: ChannelOptionPriceRow[];
  channelOptionPriceError?: unknown;
  autoDiscountPercent?: number;
} = {}) {
  const servicePrice = config.servicePrice ?? {
    id: "service-price-admin",
    serviceId: "service-a",
    optionId: "option-a",
    basePriceCents: 10_000,
    pricingTier: PricingTier.STANDARD,
  };
  const channelOptionPrices = config.channelOptionPrices ?? [];
  const channelOptionPriceQueries: unknown[] = [];
  const discountItems: unknown[] = [];
  const promoItems: unknown[] = [];

  const reader = {
    serviceOption: {
      findUnique: async (query: unknown) => {
        const id = queryWhere(query)?.id;
        return id === "option-a"
          ? { id: "option-a", serviceId: "service-a", durationMinutes: 30 }
          : null;
      },
      findFirst: async () => null,
    },
    service: {
      findUnique: async (query: unknown) => {
        const id = queryWhere(query)?.id;
        return id === "service-a" ? { category: "EXTRA", name: "Service A" } : null;
      },
    },
    channel: {
      findUnique: async (query: unknown) => {
        const id = queryWhere(query)?.id;
        return id ? { id, name: "Canal Store", allowsPromotions: true } : null;
      },
    },
    servicePrice: {
      findFirst: async (query: unknown) => {
        const where = queryWhere(query);
        if (where?.optionId === null) return null;
        if (!servicePrice) return null;
        if (servicePrice.serviceId !== where?.serviceId || servicePrice.optionId !== where?.optionId) return null;
        const pricingTier = where?.pricingTier ?? PricingTier.STANDARD;
        if ((servicePrice.pricingTier ?? PricingTier.STANDARD) !== pricingTier) return null;
        return {
          id: servicePrice.id,
          basePriceCents: servicePrice.basePriceCents,
          pricingTier,
        };
      },
    },
    channelOptionPrice: {
      findUnique: async (query: unknown) => {
        channelOptionPriceQueries.push(query);
        if (config.channelOptionPriceError) throw config.channelOptionPriceError;
        const compound = queryWhere(query)?.channelId_optionId;
        const price = channelOptionPrices.find(
          (candidate) =>
            candidate.channelId === compound?.channelId &&
            candidate.optionId === compound?.optionId
        );
        return price
          ? {
              priceCents: price.priceCents,
              isActive: price.isActive ?? true,
            }
          : null;
      },
    },
  };

  return {
    reader: reader as unknown as StoreDiscountPreviewReader,
    deps: {
      computeAutoDiscountDetail: async (args: {
        item: { lineBaseCents: number };
      }) => {
        discountItems.push(args.item);
        const discountCents = Math.round(
          args.item.lineBaseCents * (Number(config.autoDiscountPercent ?? 0) / 100)
        );
        return {
          discountCents,
          rule:
            discountCents > 0
              ? {
                  id: "discount-10",
                  name: "10%",
                  code: null,
                  scope: "ALL" as const,
                  kind: "PERCENT" as const,
                  value: Number(config.autoDiscountPercent ?? 0),
                  requiresCountry: null,
                  excludeCountry: null,
                  countryScope: null,
                  startTimeMin: null,
                  endTimeMin: null,
                  validFrom: new Date("2026-08-19T00:00:00.000Z"),
                  validTo: null,
                }
              : null,
        };
      },
      listPromotionOptions: async (args: { item: unknown }) => {
        promoItems.push(args.item);
        return [];
      },
    },
    channelOptionPriceQueries,
    discountItems,
    promoItems,
  };
}

const baseInput = {
  serviceId: "service-a",
  optionId: "option-a",
  quantity: 1,
  pax: 1,
  date: "2026-08-19",
  time: "10:00",
  customerCountry: "ES",
};

test("store discount preview sin channelId usa precio Admin", async () => {
  const fixture = makePreviewFixture({
    channelOptionPrices: [
      { channelId: "channel-store", optionId: "option-a", priceCents: 12_000 },
    ],
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: null },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 10_000);
  assert.equal(preview.pricingMeta.unitPriceCents, 10_000);
  assert.equal(preview.pricingMeta.channelPriceApplied, false);
  assert.equal(preview.channelPricingSummary, null);
  assert.equal(fixture.channelOptionPriceQueries.length, 0);
});

test("store discount preview con canal sin override usa precio Admin", async () => {
  const fixture = makePreviewFixture();

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store" },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 10_000);
  assert.equal(preview.pricingMeta.unitPriceCents, 10_000);
  assert.equal(preview.pricingMeta.channelPriceApplied, false);
  assert.equal(preview.channelPricingSummary, null);
  assert.equal(fixture.channelOptionPriceQueries.length, 1);
});

test("store discount preview con PVP canal activo usa precio efectivo", async () => {
  const fixture = makePreviewFixture({
    channelOptionPrices: [
      { channelId: "channel-store", optionId: "option-a", priceCents: 12_000 },
    ],
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store" },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 12_000);
  assert.equal(preview.pricingMeta.unitPriceCents, 12_000);
  assert.equal(preview.pricingMeta.adminUnitPriceCents, 10_000);
  assert.equal(preview.pricingMeta.channelPriceApplied, true);
});

test("store discount preview multiplica cantidad por PVP canal", async () => {
  const fixture = makePreviewFixture({
    channelOptionPrices: [
      { channelId: "channel-store", optionId: "option-a", priceCents: 12_000 },
    ],
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store", quantity: 2 },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 24_000);
  assert.equal(preview.pricingMeta.unitPriceCents, 12_000);
  assert.equal(preview.pricingMeta.quantity, 2);
});

test("store discount preview calcula descuento automatico sobre PVP canal", async () => {
  const fixture = makePreviewFixture({
    channelOptionPrices: [
      { channelId: "channel-store", optionId: "option-a", priceCents: 12_000 },
    ],
    autoDiscountPercent: 10,
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store" },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 12_000);
  assert.equal(preview.autoDiscountCents, 1_200);
  assert.equal(preview.finalTotalCents, 10_800);
  assert.equal((fixture.discountItems[0] as { lineBaseCents?: number }).lineBaseCents, 12_000);
});

test("store discount preview channelPricingSummary refleja PVP canal aplicado", async () => {
  const fixture = makePreviewFixture({
    channelOptionPrices: [
      { channelId: "channel-store", optionId: "option-a", priceCents: 12_000 },
    ],
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store" },
    fixture.deps
  );

  assert.deepEqual(preview.channelPricingSummary, {
    channelName: "Canal Store",
    basePriceCents: 10_000,
    referencePriceCents: 12_000,
    adminPriceCents: 10_000,
    effectivePriceCents: 12_000,
    optionLabel: "30 min · 1 pax",
    channelPriceApplied: true,
  });
});

test("store discount preview mantiene fallback si falta ChannelOptionPrice", async () => {
  const fixture = makePreviewFixture({
    channelOptionPriceError: missingChannelOptionPriceTableError(),
  });

  const preview = await buildStoreDiscountPreview(
    fixture.reader,
    { ...baseInput, channelId: "channel-store" },
    fixture.deps
  );

  assert.equal(preview.baseTotalCents, 10_000);
  assert.equal(preview.pricingMeta.unitPriceCents, 10_000);
  assert.equal(preview.pricingMeta.channelPriceApplied, false);
  assert.equal(preview.channelPricingSummary, null);
  assert.equal(fixture.channelOptionPriceQueries.length, 1);
});
