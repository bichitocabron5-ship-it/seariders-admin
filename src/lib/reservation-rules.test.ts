import assert from "node:assert/strict";
import test from "node:test";

import { computeRequiredContractUnits, computeRequiredPlatformUnits } from "./reservation-rules";

test("JETSKI sin licencia requiere un contrato por unidad", () => {
  assert.equal(
    computeRequiredContractUnits({
      quantity: 2,
      isLicense: false,
      serviceCategory: "JETSKI",
      items: [
        {
          quantity: 2,
          isExtra: false,
          service: { category: "JETSKI" },
        },
      ],
    }),
    2
  );
});

test("Banana Boat sin licencia no requiere contratos", () => {
  assert.equal(
    computeRequiredContractUnits({
      quantity: 2,
      isLicense: false,
      serviceCategory: "NAUTICA",
      items: [
        {
          quantity: 2,
          isExtra: false,
          service: { category: "NAUTICA" },
        },
      ],
    }),
    0
  );
});

test("Banana no hereda licencia global de otra linea del carrito", () => {
  assert.equal(
    computeRequiredContractUnits({
      quantity: 2,
      isLicense: true,
      serviceCategory: "JETSKI",
      items: [
        {
          quantity: 1,
          isExtra: false,
          service: { category: "NAUTICA" },
        },
        {
          quantity: 1,
          isExtra: false,
          service: { category: "JETSKI" },
        },
      ],
    }),
    1
  );
});

test("padre de pack no cuenta como contrato ni unidad de plataforma", () => {
  const items = [
    {
      quantity: 1,
      isExtra: false,
      isPackParent: true,
      service: { category: "PACK" },
    },
    {
      quantity: 1,
      isExtra: false,
      service: { category: "JETSKI" },
    },
    {
      quantity: 1,
      isExtra: false,
      service: { category: "TOWABLE" },
    },
  ];

  assert.equal(
    computeRequiredContractUnits({
      quantity: 3,
      isLicense: false,
      serviceCategory: "PACK",
      items,
    }),
    1
  );
  assert.equal(
    computeRequiredPlatformUnits({
      quantity: 3,
      serviceCategory: "PACK",
      items,
    }),
    2
  );
});

test("solo padre de pack no cae al fallback global", () => {
  const items = [
    {
      quantity: 1,
      isExtra: false,
      isPackParent: true,
      service: { category: "PACK" },
    },
  ];

  assert.equal(
    computeRequiredContractUnits({
      quantity: 1,
      isLicense: true,
      serviceCategory: "PACK",
      items,
    }),
    0
  );
  assert.equal(
    computeRequiredPlatformUnits({
      quantity: 1,
      serviceCategory: "PACK",
      items,
    }),
    0
  );
});
