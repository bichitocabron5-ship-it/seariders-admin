import assert from "node:assert/strict";
import test from "node:test";

import { PricingTier, type Prisma } from "@prisma/client";

import {
  createReservationWithItems,
  expandPackForReservationCreate,
} from "./createReservationWithItems";

type PackForExpansion = NonNullable<Parameters<typeof expandPackForReservationCreate>[0]["pack"]>;
type CreateReservationInput = Parameters<typeof createReservationWithItems>[0]["input"];

type ServiceRow = {
  id: string;
  code: string;
  category: string | null;
};

type ServiceOptionRow = {
  id: string;
  code: string;
  serviceId: string;
  durationMinutes: number;
};

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

function makeCreateInput(overrides: Partial<CreateReservationInput> = {}): CreateReservationInput {
  return {
    customerName: "Test Customer",
    customerPhone: null,
    customerEmail: null,
    channelId: "channel-store",
    date: "2099-08-19",
    time: "10:00",
    pax: 1,
    isLicense: false,
    pricingTier: PricingTier.STANDARD,
    items: [
      {
        serviceIdOrCode: "service-a",
        optionIdOrCode: "option-a",
        quantity: 1,
        pax: 1,
        promoCode: null,
      },
    ],
    pricing: { mode: "QUICK_SINGLE_ITEM" },
    ...overrides,
  };
}

function makeReservationTx(config: {
  services?: ServiceRow[];
  options?: ServiceOptionRow[];
  servicePrices?: ServicePriceRow[];
  channelOptionPrices?: ChannelOptionPriceRow[];
}) {
  const services = config.services ?? [
    { id: "service-a", code: "service-a", category: "EXTRA" },
  ];
  const options = config.options ?? [
    { id: "option-a", code: "option-a", serviceId: "service-a", durationMinutes: 30 },
  ];
  const servicePrices = config.servicePrices ?? [
    {
      id: "service-price-a",
      serviceId: "service-a",
      optionId: "option-a",
      basePriceCents: 10_000,
      pricingTier: PricingTier.STANDARD,
    },
  ];
  const channelOptionPrices = config.channelOptionPrices ?? [];
  const reservationCreates: Array<Record<string, unknown>> = [];
  const reservationItemCreates: Array<Record<string, unknown>> = [];
  const channelOptionPriceQueries: unknown[] = [];
  const servicePriceQueries: unknown[] = [];
  const createdReservations = new Map<string, Record<string, unknown>>();

  function channel(id: string) {
    return {
      id,
      allowsPromotions: false,
      kind: "STANDARD",
      commissionEnabled: false,
      commissionBps: 0,
      commissionPct: 0,
      promoterCommissionMode: "PERCENT",
      promoterCommissionValue: 0,
      promoterCommissionCents: 0,
      customerDiscountMode: "PERCENT",
      customerDiscountValue: 0,
      customerDiscountCents: 0,
      discountResponsibility: "COMPANY",
      promoterDiscountShareBps: 0,
      commissionRules: [],
    };
  }

  const tx = {
    channel: {
      findUnique: async (query: unknown) => channel(String(queryWhere(query)?.id ?? "")),
    },
    pack: {
      findUnique: async () => null,
    },
    service: {
      findMany: async () => services,
    },
    serviceOption: {
      findMany: async () => options,
      findFirst: async () => null,
    },
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
    slotPolicy: {
      findFirst: async () => ({
        intervalMinutes: 30,
        openTime: "00:00",
        closeTime: "23:59",
      }),
    },
    slotLimit: {
      findUnique: async () => ({ maxUnits: 99 }),
    },
    reservation: {
      findMany: async () => [],
      create: async (args: { data: Record<string, unknown> }) => {
        const id = `reservation-${reservationCreates.length + 1}`;
        reservationCreates.push(args.data);
        createdReservations.set(id, {
          ...args.data,
          id,
          createdAt: new Date("2099-08-19T08:00:00.000Z"),
        });
        return { id };
      },
      findUnique: async (query: unknown) => {
        const id = queryWhere(query)?.id;
        return id ? createdReservations.get(id) ?? null : null;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const reservation = createdReservations.get(args.where.id);
        if (reservation) Object.assign(reservation, args.data);
        return { id: args.where.id };
      },
    },
    reservationItem: {
      create: async (args: { data: Record<string, unknown> }) => {
        const id = `reservation-item-${reservationItemCreates.length + 1}`;
        reservationItemCreates.push(args.data);
        return { id };
      },
    },
    reservationContract: {
      createMany: async () => ({ count: 0 }),
    },
    channelCommissionLine: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    reservationCreates,
    reservationItemCreates,
    channelOptionPriceQueries,
    servicePriceQueries,
  };
}

function jetskiBananaPack(overrides: Partial<PackForExpansion> = {}): PackForExpansion {
  const pack = {
    id: "pack-jetski-banana",
    code: "JETSKI_BANANA",
    isActive: true,
    serviceId: "pack-service",
    packOptionId: "pack-option",
    pricePerPersonCents: 9_000,
    minPax: 1,
    maxPax: 6,
    items: [
      {
        serviceId: "jetski-service",
        optionId: "jetski-20",
        quantity: 1,
        service: { id: "jetski-service", name: "Jetski", isActive: true },
        option: { id: "jetski-20", serviceId: "jetski-service", isActive: true, durationMinutes: 20 },
      },
      {
        serviceId: "banana-service",
        optionId: "banana-15",
        quantity: 1,
        service: { id: "banana-service", name: "Banana", isActive: true },
        option: { id: "banana-15", serviceId: "banana-service", isActive: true, durationMinutes: 15 },
      },
    ],
  };

  return { ...pack, ...overrides };
}

test("pack Jetski 20 + Banana 15 expande a dos ReservationItem reales", () => {
  const expanded = expandPackForReservationCreate({
    pack: jetskiBananaPack(),
    packQty: 1,
    pax: 2,
  });

  assert.equal(expanded.totalBeforeDiscountsCents, 18_000);
  assert.equal(expanded.packQty, 1);
  assert.deepEqual(expanded.packMeta, {
    id: "pack-jetski-banana",
    code: "JETSKI_BANANA",
    serviceId: "pack-service",
    packOptionId: "pack-option",
  });
  assert.deepEqual(expanded.items, [
    {
      serviceIdOrCode: "jetski-service",
      optionIdOrCode: "jetski-20",
      quantity: 1,
      pax: 2,
      promoCode: null,
    },
    {
      serviceIdOrCode: "banana-service",
      optionIdOrCode: "banana-15",
      quantity: 1,
      pax: 2,
      promoCode: null,
    },
  ]);
});

test("pack conserva cantidades por componente multiplicadas por packQty", () => {
  const expanded = expandPackForReservationCreate({
    pack: jetskiBananaPack({
      items: [
        {
          serviceId: "jetski-service",
          optionId: "jetski-20",
          quantity: 1,
          service: { id: "jetski-service", name: "Jetski", isActive: true },
          option: { id: "jetski-20", serviceId: "jetski-service", isActive: true, durationMinutes: 20 },
        },
        {
          serviceId: "banana-service",
          optionId: "banana-15",
          quantity: 2,
          service: { id: "banana-service", name: "Banana", isActive: true },
          option: { id: "banana-15", serviceId: "banana-service", isActive: true, durationMinutes: 15 },
        },
      ],
    }),
    packQty: 2,
    pax: 2,
  });

  assert.equal(expanded.totalBeforeDiscountsCents, 36_000);
  assert.deepEqual(expanded.items.map((item) => item.quantity), [2, 4]);
  assert.deepEqual(expanded.items.map((item) => item.optionIdOrCode), ["jetski-20", "banana-15"]);
});

test("pack invalido o componentes inactivos bloquean la expansion", () => {
  assert.throws(
    () => expandPackForReservationCreate({ pack: null, packQty: 1, pax: 2 }),
    /Pack no existe o está inactivo/
  );

  assert.throws(
    () =>
      expandPackForReservationCreate({
        pack: jetskiBananaPack({
          items: [
            {
              serviceId: "jetski-service",
              optionId: "jetski-20",
              quantity: 1,
              service: { id: "jetski-service", name: "Jetski", isActive: false },
              option: { id: "jetski-20", serviceId: "jetski-service", isActive: true, durationMinutes: 20 },
            },
          ],
        }),
        packQty: 1,
        pax: 2,
      }),
    /Pack componente inactivo/
  );

  assert.throws(
    () =>
      expandPackForReservationCreate({
        pack: jetskiBananaPack({
          items: [
            {
              serviceId: "jetski-service",
              optionId: "banana-15",
              quantity: 1,
              service: { id: "jetski-service", name: "Jetski", isActive: true },
              option: { id: "banana-15", serviceId: "banana-service", isActive: true, durationMinutes: 15 },
            },
          ],
        }),
        packQty: 1,
        pax: 2,
      }),
    /opción de otro servicio/
  );
});

test("createReservationWithItems QUICK_SINGLE_ITEM sin channelId efectivo usa precio Admin", async () => {
  const fixture = makeReservationTx({
    channelOptionPrices: [
      {
        channelId: "",
        optionId: "option-a",
        priceCents: 12_000,
      },
    ],
  });

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput({ channelId: "" }),
  });

  assert.equal(fixture.channelOptionPriceQueries.length, 0);
  assert.equal(fixture.reservationItemCreates[0]?.servicePriceId, "service-price-a");
  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 10_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 10_000);
  assert.equal(fixture.reservationCreates[0]?.basePriceCents, 10_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 10_000);
});

test("createReservationWithItems QUICK_SINGLE_ITEM con canal sin override usa precio Admin", async () => {
  const fixture = makeReservationTx({});

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput(),
  });

  assert.equal(fixture.channelOptionPriceQueries.length, 1);
  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 10_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 10_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 10_000);
});

test("createReservationWithItems QUICK_SINGLE_ITEM con ChannelOptionPrice activo usa PVP canal y conserva servicePriceId Admin", async () => {
  const fixture = makeReservationTx({
    channelOptionPrices: [
      {
        channelId: "channel-store",
        optionId: "option-a",
        priceCents: 12_000,
      },
    ],
  });

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput(),
  });

  assert.equal(fixture.reservationItemCreates[0]?.servicePriceId, "service-price-a");
  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 12_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 12_000);
  assert.equal(fixture.reservationCreates[0]?.basePriceCents, 12_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 12_000);
});

test("createReservationWithItems QUICK_SINGLE_ITEM multiplica cantidad por PVP canal", async () => {
  const fixture = makeReservationTx({
    channelOptionPrices: [
      {
        channelId: "channel-store",
        optionId: "option-a",
        priceCents: 12_000,
      },
    ],
  });

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput({
      items: [
        {
          serviceIdOrCode: "service-a",
          optionIdOrCode: "option-a",
          quantity: 2,
          pax: 1,
          promoCode: null,
        },
      ],
    }),
  });

  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 12_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 24_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 24_000);
});

test("createReservationWithItems CART_MULTI_ITEM resuelve cada item por optionId", async () => {
  const fixture = makeReservationTx({
    services: [
      { id: "service-a", code: "service-a", category: "EXTRA" },
      { id: "service-b", code: "service-b", category: "EXTRA" },
    ],
    options: [
      { id: "option-a", code: "option-a", serviceId: "service-a", durationMinutes: 30 },
      { id: "option-b", code: "option-b", serviceId: "service-b", durationMinutes: 30 },
    ],
    servicePrices: [
      {
        id: "service-price-a",
        serviceId: "service-a",
        optionId: "option-a",
        basePriceCents: 10_000,
      },
      {
        id: "service-price-b",
        serviceId: "service-b",
        optionId: "option-b",
        basePriceCents: 5_000,
      },
    ],
    channelOptionPrices: [
      {
        channelId: "channel-store",
        optionId: "option-a",
        priceCents: 12_000,
      },
    ],
  });

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput({
      pricing: { mode: "CART_MULTI_ITEM" },
      items: [
        {
          serviceIdOrCode: "service-a",
          optionIdOrCode: "option-a",
          quantity: 1,
          pax: 1,
          promoCode: null,
        },
        {
          serviceIdOrCode: "service-b",
          optionIdOrCode: "option-b",
          quantity: 1,
          pax: 1,
          promoCode: null,
        },
      ],
    }),
  });

  assert.deepEqual(
    fixture.channelOptionPriceQueries.map((query) => queryWhere(query)?.channelId_optionId),
    [
      { channelId: "channel-store", optionId: "option-a" },
      { channelId: "channel-store", optionId: "option-b" },
    ]
  );
  assert.equal(fixture.reservationItemCreates[0]?.servicePriceId, "service-price-a");
  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 12_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 12_000);
  assert.equal(fixture.reservationItemCreates[1]?.servicePriceId, "service-price-b");
  assert.equal(fixture.reservationItemCreates[1]?.unitPriceCents, 5_000);
  assert.equal(fixture.reservationItemCreates[1]?.totalPriceCents, 5_000);
  assert.equal(fixture.reservationCreates[0]?.basePriceCents, 17_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 17_000);
});

test("createReservationWithItems PACK_FIXED_TOTAL no aplica ChannelOptionPrice al total fijo", async () => {
  const fixture = makeReservationTx({
    channelOptionPrices: [
      {
        channelId: "channel-store",
        optionId: "option-a",
        priceCents: 12_000,
      },
    ],
  });

  await createReservationWithItems({
    tx: fixture.tx,
    sessionUserId: "user-test",
    input: makeCreateInput({
      pricing: {
        mode: "PACK_FIXED_TOTAL",
        totalBeforeDiscountsCents: 9_000,
      },
    }),
  });

  assert.equal(fixture.channelOptionPriceQueries.length, 0);
  assert.equal(fixture.reservationItemCreates[0]?.servicePriceId, "service-price-a");
  assert.equal(fixture.reservationItemCreates[0]?.unitPriceCents, 10_000);
  assert.equal(fixture.reservationItemCreates[0]?.totalPriceCents, 10_000);
  assert.equal(fixture.reservationCreates[0]?.basePriceCents, 9_000);
  assert.equal(fixture.reservationCreates[0]?.totalPriceCents, 9_000);
});
