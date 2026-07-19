import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { replaceReservationMainItemsTx } from "./replaceReservationMainItems";

type ItemRow = {
  id: string;
  serviceId: string;
  optionId: string | null;
  servicePriceId: string | null;
  quantity: number;
  pax: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isExtra: boolean;
};

function makeTx(rows: ItemRow[]) {
  const reservationItem = {
    update: async (args: { where: { id: string }; data: Partial<ItemRow>; select?: { id?: boolean } }) => {
      const row = rows.find((item) => item.id === args.where.id);
      if (!row) throw new Error("Item not found");
      Object.assign(row, args.data);
      return args.select?.id ? { id: row.id } : { ...row };
    },
    create: async () => {
      throw new Error("Unexpected create");
    },
  };

  return { reservationItem } as unknown as Prisma.TransactionClient;
}

function baseItem(patch: Partial<ItemRow> = {}): ItemRow {
  return {
    id: "item-1",
    serviceId: "service-jetski",
    optionId: "option-30",
    servicePriceId: "price-old",
    quantity: 1,
    pax: 2,
    unitPriceCents: 10_000,
    totalPriceCents: 10_000,
    isExtra: false,
    ...patch,
  };
}

test("replaceReservationMainItemsTx marca cambio material si cambia unitPrice aunque el total coincida", async () => {
  const rows = [baseItem()];

  const result = await replaceReservationMainItemsTx(makeTx(rows), {
    reservationId: "reservation-1",
    existingItems: rows,
    nextItems: [
      {
        serviceId: "service-jetski",
        optionId: "option-30",
        servicePriceId: "price-old",
        quantity: 1,
        pax: 2,
        unitPriceCents: 9_000,
        totalPriceCents: 10_000,
      },
    ],
  });

  assert.deepEqual([...result.changedReservationItemIds], ["item-1"]);
});

test("replaceReservationMainItemsTx marca cambio material si cambia servicePriceId aunque el precio coincida", async () => {
  const rows = [baseItem()];

  const result = await replaceReservationMainItemsTx(makeTx(rows), {
    reservationId: "reservation-1",
    existingItems: rows,
    nextItems: [
      {
        serviceId: "service-jetski",
        optionId: "option-30",
        servicePriceId: "price-new",
        quantity: 1,
        pax: 2,
        unitPriceCents: 10_000,
        totalPriceCents: 10_000,
      },
    ],
  });

  assert.deepEqual([...result.changedReservationItemIds], ["item-1"]);
});

test("replaceReservationMainItemsTx conserva ids cuando el formulario reordena pack Banana y Jetski", async () => {
  const rows = [
    baseItem({
      id: "item-jetski",
      serviceId: "service-jetski",
      optionId: "option-jetski",
      servicePriceId: "price-jetski",
      unitPriceCents: 10_000,
      totalPriceCents: 10_000,
    }),
    baseItem({
      id: "item-banana",
      serviceId: "service-banana",
      optionId: "option-banana",
      servicePriceId: "price-banana",
      unitPriceCents: 8_000,
      totalPriceCents: 8_000,
    }),
  ];

  const result = await replaceReservationMainItemsTx(makeTx(rows), {
    reservationId: "reservation-1",
    existingItems: rows,
    nextItems: [
      {
        serviceId: "service-banana",
        optionId: "option-banana",
        servicePriceId: "price-banana",
        quantity: 1,
        pax: 2,
        unitPriceCents: 8_000,
        totalPriceCents: 8_000,
      },
      {
        serviceId: "service-jetski",
        optionId: "option-jetski",
        servicePriceId: "price-jetski",
        quantity: 1,
        pax: 2,
        unitPriceCents: 10_000,
        totalPriceCents: 10_000,
      },
    ],
  });

  assert.deepEqual(result.nextReservationItemIds, ["item-banana", "item-jetski"]);
  assert.deepEqual([...result.changedReservationItemIds], []);
  assert.deepEqual(result.removedReservationItemIds, []);
  assert.deepEqual(
    rows.map((item) => item.id),
    ["item-jetski", "item-banana"]
  );
});
