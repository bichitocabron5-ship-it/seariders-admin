import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier } from "@prisma/client";

import {
  buildActiveCatalogPriceIndex,
  resolvePublicOptionPriceCents,
  type ActiveCatalogPrice,
} from "./public-api/catalog-pricing";
import { findActiveServicePrice, resolveEffectiveServicePriceForChannel } from "./service-pricing";

type PricingReader = Parameters<typeof resolveEffectiveServicePriceForChannel>[0];

type ServicePriceRow = {
  id: string | null;
  basePriceCents: number;
  pricingTier: PricingTier;
} | null;

type ChannelOptionPriceRow = {
  priceCents: number;
  isActive: boolean;
} | null;

type QueryWithWhere = {
  where?: {
    optionId?: string | null;
    durationMin?: number | null;
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

function resolveBoothCatalogDisplayedPriceCents(
  prices: ActiveCatalogPrice[],
  option: {
    serviceId: string;
    id: string;
    durationMinutes: number;
    basePriceCents: number;
  }
) {
  const index = buildActiveCatalogPriceIndex(prices);
  return resolvePublicOptionPriceCents(index, option) ?? (Number(option.basePriceCents ?? 0) || 0);
}

function makePricingReader(config: {
  servicePriceByOption?: ServicePriceRow;
  servicePriceByDuration?: ServicePriceRow;
  legacyOptionBasePriceCents?: number | null;
  channelOptionPrice?: ChannelOptionPriceRow;
}) {
  const servicePriceQueries: unknown[] = [];
  const serviceOptionQueries: unknown[] = [];
  const channelOptionPriceQueries: unknown[] = [];

  const reader = {
    servicePrice: {
      findFirst: async (query: unknown) => {
        servicePriceQueries.push(query);
        return queryWhere(query)?.optionId === null
          ? config.servicePriceByDuration ?? null
          : config.servicePriceByOption ?? null;
      },
    },
    serviceOption: {
      findFirst: async (query: unknown) => {
        serviceOptionQueries.push(query);
        const basePriceCents = Number(config.legacyOptionBasePriceCents ?? 0);
        return basePriceCents > 0 ? { basePriceCents } : null;
      },
    },
    channelOptionPrice: {
      findUnique: async (query: unknown) => {
        channelOptionPriceQueries.push(query);
        return config.channelOptionPrice ?? null;
      },
    },
  };

  return {
    reader: reader as unknown as PricingReader,
    servicePriceQueries,
    serviceOptionQueries,
    channelOptionPriceQueries,
  };
}

const baseParams = {
  serviceId: "service-jetski",
  optionId: "option-20",
  durationMinutes: 20,
  now: new Date("2026-08-19T10:00:00.000Z"),
  pricingTier: PricingTier.STANDARD,
};

const adminPrice = {
  id: "service-price-admin",
  basePriceCents: 10_000,
  pricingTier: PricingTier.STANDARD,
};

test("findActiveServicePrice usa precio por optionId antes que durationMin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: {
      id: "service-price-option",
      basePriceCents: 11_000,
      pricingTier: PricingTier.STANDARD,
    },
    servicePriceByDuration: {
      id: "service-price-duration",
      basePriceCents: 9_000,
      pricingTier: PricingTier.STANDARD,
    },
    legacyOptionBasePriceCents: 8_000,
  });

  const result = await findActiveServicePrice(fixture.reader, baseParams);

  assert.deepEqual(result, {
    id: "service-price-option",
    basePriceCents: 11_000,
    pricingTier: PricingTier.STANDARD,
  });
  assert.equal(fixture.servicePriceQueries.length, 1);
  assert.equal(queryWhere(fixture.servicePriceQueries[0])?.optionId, "option-20");
  assert.equal(fixture.serviceOptionQueries.length, 0);
});

test("findActiveServicePrice cae a precio legacy por durationMin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: {
      id: "service-price-duration",
      basePriceCents: 9_000,
      pricingTier: PricingTier.STANDARD,
    },
    legacyOptionBasePriceCents: 8_000,
  });

  const result = await findActiveServicePrice(fixture.reader, baseParams);

  assert.deepEqual(result, {
    id: "service-price-duration",
    basePriceCents: 9_000,
    pricingTier: PricingTier.STANDARD,
  });
  assert.equal(fixture.servicePriceQueries.length, 2);
  assert.equal(queryWhere(fixture.servicePriceQueries[1])?.optionId, null);
  assert.equal(queryWhere(fixture.servicePriceQueries[1])?.durationMin, 20);
  assert.equal(fixture.serviceOptionQueries.length, 0);
});

test("findActiveServicePrice puede desactivar fallback legacy de ServiceOption", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: null,
    legacyOptionBasePriceCents: 8_000,
  });

  const result = await findActiveServicePrice(fixture.reader, {
    ...baseParams,
    allowLegacyOptionFallback: false,
  });

  assert.equal(result, null);
  assert.equal(fixture.servicePriceQueries.length, 2);
  assert.equal(fixture.serviceOptionQueries.length, 0);
});

test("precio Booth mostrado y precio de creacion coinciden por optionId", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: {
      id: "service-price-option",
      basePriceCents: 11_000,
      pricingTier: PricingTier.STANDARD,
    },
    servicePriceByDuration: {
      id: "service-price-duration",
      basePriceCents: 9_000,
      pricingTier: PricingTier.STANDARD,
    },
    legacyOptionBasePriceCents: 8_000,
  });

  const option = {
    serviceId: baseParams.serviceId,
    id: baseParams.optionId,
    durationMinutes: baseParams.durationMinutes,
    basePriceCents: 8_000,
  };
  const displayedPriceCents = resolveBoothCatalogDisplayedPriceCents(
    [
      {
        serviceId: option.serviceId,
        optionId: null,
        durationMin: option.durationMinutes,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 9_000,
      },
      {
        serviceId: option.serviceId,
        optionId: option.id,
        durationMin: null,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 11_000,
      },
    ],
    option
  );
  const creationPrice = await findActiveServicePrice(fixture.reader, baseParams);

  assert.equal(displayedPriceCents, 11_000);
  assert.equal(creationPrice?.basePriceCents, displayedPriceCents);
});

test("precio Booth mostrado y precio de creacion coinciden con fallback durationMin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: {
      id: "service-price-duration",
      basePriceCents: 9_000,
      pricingTier: PricingTier.STANDARD,
    },
    legacyOptionBasePriceCents: 8_000,
  });

  const option = {
    serviceId: baseParams.serviceId,
    id: baseParams.optionId,
    durationMinutes: baseParams.durationMinutes,
    basePriceCents: 8_000,
  };
  const displayedPriceCents = resolveBoothCatalogDisplayedPriceCents(
    [
      {
        serviceId: option.serviceId,
        optionId: null,
        durationMin: option.durationMinutes,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: 9_000,
      },
    ],
    option
  );
  const creationPrice = await findActiveServicePrice(fixture.reader, baseParams);

  assert.equal(displayedPriceCents, 9_000);
  assert.equal(creationPrice?.basePriceCents, displayedPriceCents);
});

test("resolveEffectiveServicePriceForChannel sin channelId usa precio Admin", async () => {
  const fixture = makePricingReader({ servicePriceByOption: adminPrice });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, baseParams);

  assert.deepEqual(result, {
    servicePriceId: "service-price-admin",
    adminPriceCents: 10_000,
    effectivePriceCents: 10_000,
    channelPriceApplied: false,
    pricingTier: PricingTier.STANDARD,
  });
  assert.equal(fixture.channelOptionPriceQueries.length, 0);
});

test("resolveEffectiveServicePriceForChannel con canal sin ChannelOptionPrice usa precio Admin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: adminPrice,
    channelOptionPrice: null,
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-direct",
  });

  assert.equal(result?.effectivePriceCents, 10_000);
  assert.equal(result?.channelPriceApplied, false);
  assert.equal(fixture.channelOptionPriceQueries.length, 1);
  assert.equal(
    queryWhere(fixture.channelOptionPriceQueries[0])?.channelId_optionId?.channelId,
    "channel-direct"
  );
  assert.equal(
    queryWhere(fixture.channelOptionPriceQueries[0])?.channelId_optionId?.optionId,
    "option-20"
  );
});

test("resolveEffectiveServicePriceForChannel con ChannelOptionPrice activo usa PVP canal", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: adminPrice,
    channelOptionPrice: { priceCents: 12_500, isActive: true },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-promoter",
  });

  assert.deepEqual(result, {
    servicePriceId: "service-price-admin",
    adminPriceCents: 10_000,
    effectivePriceCents: 12_500,
    channelPriceApplied: true,
    pricingTier: PricingTier.STANDARD,
  });
});

test("resolveEffectiveServicePriceForChannel con ChannelOptionPrice inactivo usa precio Admin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: adminPrice,
    channelOptionPrice: { priceCents: 12_500, isActive: false },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-promoter",
  });

  assert.equal(result?.adminPriceCents, 10_000);
  assert.equal(result?.effectivePriceCents, 10_000);
  assert.equal(result?.channelPriceApplied, false);
});

test("resolveEffectiveServicePriceForChannel mantiene servicePriceId del precio Admin", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: {
      ...adminPrice,
      id: "service-price-traceable",
    },
    channelOptionPrice: { priceCents: 9_000, isActive: true },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-promoter",
  });

  assert.equal(result?.servicePriceId, "service-price-traceable");
  assert.equal(result?.effectivePriceCents, 9_000);
});

test("resolveEffectiveServicePriceForChannel respeta pricingTier solicitado", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: {
      id: "service-price-resident",
      basePriceCents: 7_500,
      pricingTier: PricingTier.RESIDENT,
    },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    pricingTier: PricingTier.RESIDENT,
  });

  assert.equal(result?.pricingTier, PricingTier.RESIDENT);
  assert.equal(result?.adminPriceCents, 7_500);
  assert.equal(queryWhere(fixture.servicePriceQueries[0])?.pricingTier, PricingTier.RESIDENT);
});

test("resolveEffectiveServicePriceForChannel sin precio Admin vigente no aplica PVP canal aislado", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: null,
    legacyOptionBasePriceCents: null,
    channelOptionPrice: { priceCents: 12_500, isActive: true },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-promoter",
  });

  assert.equal(result, null);
  assert.equal(fixture.channelOptionPriceQueries.length, 0);
});

test("resolveEffectiveServicePriceForChannel permite PVP canal aislado cuando se solicita", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: null,
    legacyOptionBasePriceCents: null,
    channelOptionPrice: { priceCents: 12_500, isActive: true },
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-web",
    allowLegacyOptionFallback: false,
    allowChannelOnlyPrice: true,
  });

  assert.deepEqual(result, {
    servicePriceId: null,
    adminPriceCents: 12_500,
    effectivePriceCents: 12_500,
    channelPriceApplied: true,
    pricingTier: PricingTier.STANDARD,
  });
  assert.equal(fixture.serviceOptionQueries.length, 0);
  assert.equal(fixture.channelOptionPriceQueries.length, 1);
});

test("resolveEffectiveServicePriceForChannel WEB sin precio canal no cae a basePrice legacy", async () => {
  const fixture = makePricingReader({
    servicePriceByOption: null,
    servicePriceByDuration: null,
    legacyOptionBasePriceCents: 8_000,
    channelOptionPrice: null,
  });

  const result = await resolveEffectiveServicePriceForChannel(fixture.reader, {
    ...baseParams,
    channelId: "channel-web",
    allowLegacyOptionFallback: false,
    allowChannelOnlyPrice: true,
  });

  assert.equal(result, null);
  assert.equal(fixture.serviceOptionQueries.length, 0);
  assert.equal(fixture.channelOptionPriceQueries.length, 1);
});
