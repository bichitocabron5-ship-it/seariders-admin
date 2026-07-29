import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import {
  buildReservationCapacityUsages,
  type ReservationCapacityReservationLike,
} from "@/lib/reservation-capacity";
import { buildAvailabilitySnapshotFromCapacityUsages } from "@/lib/availability-snapshot";
import { assertSlotCapacityForItemsOrThrow } from "@/lib/slot-capacity";
import { resolveStoreCalendarReservationSummary } from "@/lib/store-calendar";
import { utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";

const TZ = "Europe/Madrid";
const DATE = "2026-07-29";

function atMadrid(hm: string) {
  const date = utcDateTimeFromYmdHmInTz(TZ, DATE, hm);
  if (!date) throw new Error(`Invalid test time ${hm}`);
  return date;
}

function reservation(
  patch: Partial<ReservationCapacityReservationLike> = {}
): ReservationCapacityReservationLike {
  return {
    id: "reservation-1",
    scheduledTime: atMadrid("09:00"),
    quantity: 1,
    service: { category: "LEGACY" },
    option: { durationMinutes: 30 },
    items: [],
    ...patch,
  };
}

function item(args: {
  id: string;
  category: string;
  durationMinutes: number;
  quantity?: number;
  isExtra?: boolean;
  isPackParent?: boolean;
  name?: string;
}) {
  return {
    id: args.id,
    quantity: args.quantity ?? 1,
    isExtra: args.isExtra ?? false,
    isPackParent: args.isPackParent ?? false,
    service: {
      name: args.name ?? args.category,
      category: args.category,
    },
    option: {
      durationMinutes: args.durationMinutes,
      paxMax: 2,
    },
  };
}

function snapshot(usages: ReturnType<typeof buildReservationCapacityUsages>, selected = {
  selectedCategory: "JETSKI",
  selectedDurationMinutes: 30,
  selectedQuantity: 1,
}) {
  return buildAvailabilitySnapshotFromCapacityUsages({
    date: DATE,
    intervalMinutes: 30,
    openTime: "09:00",
    closeTime: "11:00",
    limits: { JETSKI: 2, TOWABLE: 1 },
    usages,
    ...selected,
  });
}

function fakeCapacityTx(args: {
  reservations: ReservationCapacityReservationLike[];
  limits?: Record<string, number>;
}) {
  const limits = args.limits ?? { JETSKI: 1, TOWABLE: 1 };
  return {
    slotPolicy: {
      findFirst: async () => ({ intervalMinutes: 30, openTime: "09:00", closeTime: "11:00" }),
    },
    slotLimit: {
      findUnique: async (query: { where: { category: string } }) => {
        const maxUnits = limits[String(query.where.category).toUpperCase()];
        return maxUnits == null ? null : { maxUnits };
      },
    },
    reservation: {
      findMany: async () => args.reservations,
    },
  } as unknown as Prisma.TransactionClient;
}

test("reserva simple usa ReservationItem como ocupacion", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      service: { category: "PACK" },
      option: { durationMinutes: 0 },
      quantity: 99,
      items: [item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, quantity: 1 })],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    category: usage.category,
    durationMinutes: usage.durationMinutes,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    { category: "JETSKI", durationMinutes: 30, quantity: 1, source: "ITEM" },
  ]);
});

test("pack Jetski + Banana ocupa solo por componentes reales", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      service: { category: "PACK" },
      option: { durationMinutes: 0 },
      items: [
        item({ id: "item-pack-parent", category: "PACK", durationMinutes: 0, isPackParent: true, name: "Pack" }),
        item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, name: "Jetski" }),
        item({ id: "item-banana", category: "TOWABLE", durationMinutes: 15, name: "Banana" }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => usage.category), ["JETSKI", "TOWABLE"]);
  assert.equal(usages.some((usage) => usage.category === "PACK"), false);
});

test("carrito multiactividad mantiene todas sus lineas operativas", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      items: [
        item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, quantity: 1 }),
        item({ id: "item-banana", category: "TOWABLE", durationMinutes: 15, quantity: 1 }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => `${usage.category}:${usage.durationMinutes}:${usage.quantity}`), [
    "JETSKI:30:1",
    "TOWABLE:15:1",
  ]);
});

test("dos Jetski consumen dos unidades de capacidad", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      items: [item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, quantity: 2 })],
    })
  );
  const availability = snapshot(usages);
  const nine = availability.slots.find((slot) => slot.time === "09:00");

  assert.equal(nine?.used.JETSKI, 2);
  assert.equal(nine?.free.JETSKI, 0);
  assert.equal(nine?.isSelectable.JETSKI, false);
});

test("legacy sin ReservationItem usa Reservation.service y Reservation.option como fallback", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      quantity: 2,
      service: { category: "JETSKI" },
      option: { durationMinutes: 45 },
      items: [],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    category: usage.category,
    durationMinutes: usage.durationMinutes,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    { category: "JETSKI", durationMinutes: 45, quantity: 2, source: "LEGACY" },
  ]);
});

test("legacy con extra aislado sigue usando la actividad principal como fallback", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      quantity: 2,
      service: { category: "JETSKI" },
      option: { durationMinutes: 45 },
      items: [
        item({
          id: "item-extra",
          category: "EXTRA",
          durationMinutes: 15,
          quantity: 1,
          isExtra: true,
        }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    reservationItemId: usage.reservationItemId,
    category: usage.category,
    durationMinutes: usage.durationMinutes,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    {
      reservationItemId: null,
      category: "JETSKI",
      durationMinutes: 45,
      quantity: 2,
      source: "LEGACY",
    },
  ]);
});

test("legacy con pack parent sin componentes reales usa fallback seguro", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      quantity: 1,
      service: { category: "JETSKI" },
      option: { durationMinutes: 30 },
      items: [
        item({
          id: "item-pack-parent",
          category: "JETSKI",
          durationMinutes: 30,
          isPackParent: true,
        }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    reservationItemId: usage.reservationItemId,
    category: usage.category,
    durationMinutes: usage.durationMinutes,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    {
      reservationItemId: null,
      category: "JETSKI",
      durationMinutes: 30,
      quantity: 1,
      source: "LEGACY",
    },
  ]);
});

test("reserva moderna con items reales no duplica fallback legacy", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      quantity: 99,
      service: { category: "JETSKI" },
      option: { durationMinutes: 90 },
      items: [
        item({ id: "item-banana", category: "TOWABLE", durationMinutes: 15, quantity: 1 }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    reservationItemId: usage.reservationItemId,
    category: usage.category,
    durationMinutes: usage.durationMinutes,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    {
      reservationItemId: "item-banana",
      category: "TOWABLE",
      durationMinutes: 15,
      quantity: 1,
      source: "ITEM",
    },
  ]);
});

test("reserva moderna con item real y extra cuenta solo el item real", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      service: { category: "JETSKI" },
      option: { durationMinutes: 30 },
      items: [
        item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, quantity: 1 }),
        item({
          id: "item-extra",
          category: "JETSKI",
          durationMinutes: 30,
          quantity: 1,
          isExtra: true,
        }),
      ],
    })
  );

  assert.deepEqual(usages.map((usage) => ({
    reservationItemId: usage.reservationItemId,
    category: usage.category,
    quantity: usage.quantity,
    source: usage.source,
  })), [
    {
      reservationItemId: "item-jetski",
      category: "JETSKI",
      quantity: 1,
      source: "ITEM",
    },
  ]);
});

test("calendario resume pack por lineas reales y no por el padre", () => {
  const summary = resolveStoreCalendarReservationSummary(
    reservation({
      service: { name: "Pack padre", category: "PACK" },
      option: { durationMinutes: 0, paxMax: 0 },
      items: [
        item({ id: "item-pack-parent", category: "PACK", durationMinutes: 0, isPackParent: true, name: "Pack padre" }),
        item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, name: "Jetski" }),
        item({ id: "item-banana", category: "TOWABLE", durationMinutes: 15, name: "Banana" }),
      ],
    })
  );

  assert.equal(summary.service?.name, "Jetski + Banana");
  assert.equal(summary.service?.category, "JETSKI + TOWABLE");
  assert.equal(summary.option?.durationMinutes, null);
});

test("disponibilidad calcula huecos consecutivos con ocupacion por item", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      scheduledTime: atMadrid("09:30"),
      items: [item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30, quantity: 2 })],
    })
  );
  const availability = snapshot(usages, {
    selectedCategory: "JETSKI",
    selectedDurationMinutes: 60,
    selectedQuantity: 1,
  });

  assert.equal(availability.slots.find((slot) => slot.time === "09:00")?.isSelectable.JETSKI, false);
  assert.equal(availability.slots.find((slot) => slot.time === "10:00")?.isSelectable.JETSKI, true);
});

test("disponibilidad bloquea una reserva legacy aunque solo tenga extra como item", () => {
  const usages = buildReservationCapacityUsages(
    reservation({
      quantity: 1,
      service: { category: "JETSKI" },
      option: { durationMinutes: 30 },
      items: [
        item({
          id: "item-extra",
          category: "EXTRA",
          durationMinutes: 15,
          isExtra: true,
        }),
      ],
    })
  );
  const availability = buildAvailabilitySnapshotFromCapacityUsages({
    date: DATE,
    intervalMinutes: 30,
    openTime: "09:00",
    closeTime: "11:00",
    limits: { JETSKI: 1 },
    usages,
    selectedCategory: "JETSKI",
    selectedDurationMinutes: 30,
    selectedQuantity: 1,
  });
  const nine = availability.slots.find((slot) => slot.time === "09:00");

  assert.equal(nine?.used.JETSKI, 1);
  assert.equal(nine?.free.JETSKI, 0);
  assert.equal(nine?.isSelectable.JETSKI, false);
});

test("overbooking detecta packs existentes por sus componentes ReservationItem", async () => {
  const tx = fakeCapacityTx({
    limits: { JETSKI: 1, TOWABLE: 1 },
    reservations: [
      reservation({
        service: { category: "PACK" },
        option: { durationMinutes: 0 },
        items: [
          item({ id: "item-pack-parent", category: "PACK", durationMinutes: 0, isPackParent: true }),
          item({ id: "item-jetski", category: "JETSKI", durationMinutes: 30 }),
          item({ id: "item-banana", category: "TOWABLE", durationMinutes: 15 }),
        ],
      }),
    ],
  });

  await assert.rejects(
    () =>
      assertSlotCapacityForItemsOrThrow({
        tx,
        dateStartUtc: utcDateFromYmdInTz(TZ, DATE),
        dateEndExclusiveUtc: utcDateFromYmdInTz(TZ, "2026-07-30"),
        scheduledStartUtc: atMadrid("09:00"),
        items: [{ category: "JETSKI", durationMinutes: 30, quantity: 1 }],
      }),
    /Slot completo \(JETSKI\)/
  );
});

test("overbooking detecta reserva legacy aunque un extra sea su unico item", async () => {
  const tx = fakeCapacityTx({
    limits: { JETSKI: 1 },
    reservations: [
      reservation({
        service: { category: "JETSKI" },
        option: { durationMinutes: 30 },
        items: [
          item({
            id: "item-extra",
            category: "EXTRA",
            durationMinutes: 15,
            isExtra: true,
          }),
        ],
      }),
    ],
  });

  await assert.rejects(
    () =>
      assertSlotCapacityForItemsOrThrow({
        tx,
        dateStartUtc: utcDateFromYmdInTz(TZ, DATE),
        dateEndExclusiveUtc: utcDateFromYmdInTz(TZ, "2026-07-30"),
        scheduledStartUtc: atMadrid("09:00"),
        items: [{ category: "JETSKI", durationMinutes: 30, quantity: 1 }],
      }),
    /Slot completo \(JETSKI\)/
  );
});

test("overbooking detecta dos lineas Jetski en la misma solicitud", async () => {
  const tx = fakeCapacityTx({
    limits: { JETSKI: 1 },
    reservations: [],
  });

  await assert.rejects(
    () =>
      assertSlotCapacityForItemsOrThrow({
        tx,
        dateStartUtc: utcDateFromYmdInTz(TZ, DATE),
        dateEndExclusiveUtc: utcDateFromYmdInTz(TZ, "2026-07-30"),
        scheduledStartUtc: atMadrid("09:00"),
        items: [
          { category: "JETSKI", durationMinutes: 30, quantity: 1 },
          { category: "JETSKI", durationMinutes: 30, quantity: 1 },
        ],
      }),
    /Slot completo \(JETSKI\)/
  );
});
