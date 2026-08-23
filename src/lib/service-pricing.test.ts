import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier } from "@prisma/client";

import { resolveEffectiveServicePriceForChannel } from "./service-pricing";

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
