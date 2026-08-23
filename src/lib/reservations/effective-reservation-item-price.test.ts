import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier } from "@prisma/client";

import {
  buildPreservedReservationItemPriceSnapshot,
  resolveEffectiveReservationItemPrice,
} from "./effective-reservation-item-price";

type PricingReader = Parameters<typeof resolveEffectiveReservationItemPrice>[0];

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

function makePricingReader(config: {
  servicePrices?: ServicePriceRow[];
  channelOptionPrices?: ChannelOptionPriceRow[];
}) {
  const servicePrices = config.servicePrices ?? [
    {
      id: "service-price-admin",
      serviceId: "service-jetski",
      optionId: "option-20",
      basePriceCents: 10_000,
    },
  ];
  const channelOptionPrices = config.channelOptionPrices ?? [];
  const servicePriceQueries: unknown[] = [];
  const channelOptionPriceQueries: unknown[] = [];

  const reader = {
    servicePrice: {
      findFirst: async (query: unknown) => {
        servicePriceQueries.push(query);
        const where = queryWhere(query);
        if (where?.optionId === null) return null;
        const pricingTier = where?.pricingTier ?? PricingTier.STANDARD;
        const price = servicePrices.find(
          (candidate) =>
            candidate.serviceId === where?.serviceId &&
            candidate.optionId === where?.optionId &&
            (candidate.pricingTier ?? PricingTier.STANDARD) === pricingTier
        );

        return price
          ? {
              id: price.id,
              basePriceCents: price.basePriceCents,
              pricingTier,
            }
          : null;
      },
    },
    serviceOption: {
      findFirst: async () => null,
    },
    channelOptionPrice: {
      findUnique: async (query: unknown) => {
        channelOptionPriceQueries.push(query);
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
    reader: reader as unknown as PricingReader,
    servicePriceQueries,
    channelOptionPriceQueries,
  };
}

const baseParams = {
  serviceId: "service-jetski",
  optionId: "option-20",
  durationMinutes: 20,
  now: new Date("2026-08-23T10:00:00.000Z"),
  pricingTier: PricingTier.STANDARD,
};

test("update recalculatePricing usa PVP canal y no vuelve a Admin", async () => {
  const fixture = makePricingReader({
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-20", priceCents: 12_000 },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-a",
  });

  assert.deepEqual(result, {
    servicePriceId: "service-price-admin",
    unitPriceCents: 12_000,
    totalPriceCents: 12_000,
  });
});

test("update sin override usa precio Admin", async () => {
  const fixture = makePricingReader({});

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-without-override",
  });

  assert.equal(result?.servicePriceId, "service-price-admin");
  assert.equal(result?.unitPriceCents, 10_000);
  assert.equal(result?.totalPriceCents, 10_000);
});

test("update cambio de cantidad multiplica el PVP efectivo", async () => {
  const fixture = makePricingReader({
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-20", priceCents: 12_000 },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 2,
    channelId: "channel-a",
  });

  assert.equal(result?.unitPriceCents, 12_000);
  assert.equal(result?.totalPriceCents, 24_000);
});

test("update multi-item resuelve cada optionId por separado", async () => {
  const fixture = makePricingReader({
    servicePrices: [
      {
        id: "service-price-jetski",
        serviceId: "service-jetski",
        optionId: "option-20",
        basePriceCents: 10_000,
      },
      {
        id: "service-price-banana",
        serviceId: "service-banana",
        optionId: "option-15",
        basePriceCents: 5_000,
      },
    ],
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-20", priceCents: 12_000 },
      { channelId: "channel-a", optionId: "option-15", priceCents: 6_500 },
    ],
  });

  const jetski = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-a",
  });
  const banana = await resolveEffectiveReservationItemPrice(fixture.reader, {
    serviceId: "service-banana",
    optionId: "option-15",
    durationMinutes: 15,
    quantity: 2,
    now: baseParams.now,
    pricingTier: PricingTier.STANDARD,
    channelId: "channel-a",
  });

  assert.equal(jetski?.servicePriceId, "service-price-jetski");
  assert.equal(jetski?.unitPriceCents, 12_000);
  assert.equal(banana?.servicePriceId, "service-price-banana");
  assert.equal(banana?.unitPriceCents, 6_500);
  assert.equal(banana?.totalPriceCents, 13_000);
  assert.deepEqual(
    fixture.channelOptionPriceQueries.map((query) => queryWhere(query)?.channelId_optionId),
    [
      { channelId: "channel-a", optionId: "option-20" },
      { channelId: "channel-a", optionId: "option-15" },
    ]
  );
});

test("update cambio de canal con recalculo usa el canal final", async () => {
  const fixture = makePricingReader({
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-20", priceCents: 12_000 },
      { channelId: "channel-b", optionId: "option-20", priceCents: 13_500 },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-b",
  });

  assert.equal(result?.unitPriceCents, 13_500);
  assert.equal(
    queryWhere(fixture.channelOptionPriceQueries[0])?.channelId_optionId?.channelId,
    "channel-b"
  );
});

test("formalize normal con snapshot existente conserva el precio guardado", () => {
  const result = buildPreservedReservationItemPriceSnapshot({
    servicePriceId: "service-price-admin",
    unitPriceCents: 12_000,
    totalPriceCents: 24_000,
  });

  assert.deepEqual(result, {
    servicePriceId: "service-price-admin",
    unitPriceCents: 12_000,
    totalPriceCents: 24_000,
  });
});

test("formalize con recalculatePricing usa PVP canal y conserva servicePriceId Admin", async () => {
  const fixture = makePricingReader({
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-20", priceCents: 12_000 },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-a",
  });

  assert.equal(result?.servicePriceId, "service-price-admin");
  assert.equal(result?.unitPriceCents, 12_000);
  assert.equal(result?.totalPriceCents, 12_000);
});

test("formalize con canal sin override usa Admin", async () => {
  const fixture = makePricingReader({});

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    ...baseParams,
    quantity: 1,
    channelId: "channel-without-override",
  });

  assert.equal(result?.servicePriceId, "service-price-admin");
  assert.equal(result?.unitPriceCents, 10_000);
});

test("add-item comercial usa el PVP del canal de la reserva", async () => {
  const fixture = makePricingReader({
    servicePrices: [
      {
        id: "service-price-banana",
        serviceId: "service-banana",
        optionId: "option-15",
        basePriceCents: 5_000,
      },
    ],
    channelOptionPrices: [
      { channelId: "channel-a", optionId: "option-15", priceCents: 6_500 },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    serviceId: "service-banana",
    optionId: "option-15",
    durationMinutes: 15,
    quantity: 1,
    now: baseParams.now,
    pricingTier: PricingTier.STANDARD,
    channelId: "channel-a",
  });

  assert.deepEqual(result, {
    servicePriceId: "service-price-banana",
    unitPriceCents: 6_500,
    totalPriceCents: 6_500,
  });
});

test("add-item canal sin override usa Admin y cantidad >1 multiplica", async () => {
  const fixture = makePricingReader({
    servicePrices: [
      {
        id: "service-price-banana",
        serviceId: "service-banana",
        optionId: "option-15",
        basePriceCents: 5_000,
      },
    ],
  });

  const result = await resolveEffectiveReservationItemPrice(fixture.reader, {
    serviceId: "service-banana",
    optionId: "option-15",
    durationMinutes: 15,
    quantity: 3,
    now: baseParams.now,
    pricingTier: PricingTier.STANDARD,
    channelId: "channel-without-override",
  });

  assert.equal(result?.servicePriceId, "service-price-banana");
  assert.equal(result?.unitPriceCents, 5_000);
  assert.equal(result?.totalPriceCents, 15_000);
});
