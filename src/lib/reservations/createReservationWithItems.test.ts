import assert from "node:assert/strict";
import test from "node:test";

import { expandPackForReservationCreate } from "./createReservationWithItems";

type PackForExpansion = NonNullable<Parameters<typeof expandPackForReservationCreate>[0]["pack"]>;

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
