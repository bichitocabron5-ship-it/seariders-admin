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
