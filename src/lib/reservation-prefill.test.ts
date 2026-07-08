import assert from "node:assert/strict";
import test from "node:test";

import { buildReservationPrefillCartItems } from "./reservation-prefill";

test("prefill reconstruye items con promoCode y snapshot unitario", () => {
  const items = buildReservationPrefillCartItems({
    promoCode: "mayo",
    fallbackOptionId: "option-fallback",
    items: [
      {
        serviceId: "service-jetski",
        optionId: "option-30",
        servicePriceId: "price-1",
        quantity: 1,
        pax: 2,
        isExtra: false,
        unitPriceCents: 12000,
        totalPriceCents: 9000,
      },
      {
        serviceId: "service-extra",
        optionId: "option-extra",
        quantity: 1,
        pax: 1,
        isExtra: true,
        unitPriceCents: 3000,
        totalPriceCents: 3000,
      },
    ],
  });

  assert.deepEqual(items, [
    {
      serviceId: "service-jetski",
      optionId: "option-30",
      servicePriceId: "price-1",
      quantity: 1,
      pax: 2,
      promoCode: "MAYO",
      unitPriceCents: 12000,
      totalPriceCents: 9000,
    },
  ]);
});

test("prefill usa optionId fallback en items legacy sin optionId", () => {
  const items = buildReservationPrefillCartItems({
    promoCode: null,
    fallbackOptionId: "option-legacy",
    items: [
      {
        serviceId: "service-jetski",
        optionId: null,
        quantity: 1,
        pax: 1,
        isExtra: false,
      },
    ],
  });

  assert.equal(items[0]?.optionId, "option-legacy");
  assert.equal(items[0]?.promoCode, null);
});
