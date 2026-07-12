import assert from "node:assert/strict";
import test from "node:test";

import { buildReservationContractRequirements } from "./reservation-contract-requirements";

function item(args: {
  id: string;
  category: string;
  name: string;
  optionId: string;
  durationMinutes: number;
  quantity?: number;
}) {
  return {
    id: args.id,
    serviceId: `service-${args.id}`,
    optionId: args.optionId,
    quantity: args.quantity ?? 1,
    pax: 1,
    totalPriceCents: 10000,
    isExtra: false,
    service: {
      name: args.name,
      category: args.category,
    },
    option: {
      durationMinutes: args.durationMinutes,
    },
  };
}

test("carrito Banana primero y Jetski despues genera solo target Jetski", () => {
  const requirements = buildReservationContractRequirements({
    quantity: 2,
    isLicense: false,
    items: [
      item({
        id: "banana",
        category: "NAUTICA",
        name: "Banana",
        optionId: "banana-15",
        durationMinutes: 15,
      }),
      item({
        id: "jetski",
        category: "JETSKI",
        name: "Jetski",
        optionId: "jetski-20",
        durationMinutes: 20,
      }),
    ],
  });

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0]?.reservationItemId, "jetski");
  assert.equal(requirements[0]?.templateCode, "JETSKI_NO_LICENSE");
  assert.equal(requirements[0]?.durationMinutes, 20);
});

test("carrito Jetski primero y Banana despues genera el mismo target Jetski", () => {
  const requirements = buildReservationContractRequirements({
    quantity: 2,
    isLicense: false,
    items: [
      item({
        id: "jetski",
        category: "JETSKI",
        name: "Jetski",
        optionId: "jetski-20",
        durationMinutes: 20,
      }),
      item({
        id: "banana",
        category: "NAUTICA",
        name: "Banana",
        optionId: "banana-15",
        durationMinutes: 15,
      }),
    ],
  });

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0]?.reservationItemId, "jetski");
  assert.equal(requirements[0]?.templateCode, "JETSKI_NO_LICENSE");
  assert.equal(requirements[0]?.logicalUnitIndex, 1);
});

test("pack Jetski 20 y Banana 15 conserva duracion de la linea Jetski", () => {
  const requirements = buildReservationContractRequirements({
    quantity: 2,
    isLicense: false,
    items: [
      item({
        id: "jetski",
        category: "JETSKI",
        name: "Jetski 20 min",
        optionId: "jetski-20",
        durationMinutes: 20,
      }),
      item({
        id: "banana",
        category: "NAUTICA",
        name: "Banana 15 min",
        optionId: "banana-15",
        durationMinutes: 15,
      }),
    ],
  });

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0]?.serviceName, "Jetski 20 min");
  assert.equal(requirements[0]?.durationMinutes, 20);
});

test("dos lineas Jetski con opciones distintas producen targets separados", () => {
  const requirements = buildReservationContractRequirements({
    quantity: 2,
    isLicense: false,
    items: [
      item({
        id: "jetski-20",
        category: "JETSKI",
        name: "Jetski 20",
        optionId: "option-20",
        durationMinutes: 20,
      }),
      item({
        id: "jetski-40",
        category: "JETSKI",
        name: "Jetski 40",
        optionId: "option-40",
        durationMinutes: 40,
      }),
    ],
  });

  assert.deepEqual(
    requirements.map((requirement) => [
      requirement.reservationItemId,
      requirement.optionId,
      requirement.durationMinutes,
      requirement.logicalUnitIndex,
    ]),
    [
      ["jetski-20", "option-20", 20, 1],
      ["jetski-40", "option-40", 40, 2],
    ]
  );
});
