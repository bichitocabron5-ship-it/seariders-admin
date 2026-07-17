import assert from "node:assert/strict";
import test from "node:test";

import { computeRequiredContractUnits } from "./reservation-rules";

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
