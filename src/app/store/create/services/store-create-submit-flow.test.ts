import assert from "node:assert/strict";
import test from "node:test";

import { submitStoreCreateMigrateFlow } from "./store-create-submit-flow";

test("formalize submit devuelve progreso del endpoint sin navegar internamente", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "reservation-1",
        requiredUnits: 2,
        readyCount: 2,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    const result = await submitStoreCreateMigrateFlow({
      migrateReservationId: "reservation-1",
      customerName: "Laura",
      quantity: 2,
      pax: 2,
      isVoucherFormalizeFlow: false,
      serviceId: "service-1",
      optionId: "option-1",
      channelId: "channel-1",
      cartItemsLength: 0,
      canCreate: true,
      uiMode: "FORMALIZE",
      dateStr: "2026-07-03",
      todayYmd: "2026-07-03",
      cartItems: [],
      customerPhone: "600000000",
      customerEmail: "",
      customerCountry: "ES",
      customerAddress: "",
      customerPostalCode: "",
      customerBirthDate: "",
      customerDocType: "",
      customerDocNumber: "",
      marketingSource: "",
      companions: 0,
      timeStr: "10:00",
      isLicense: false,
      jetskiLicenseMode: "NONE",
      pricingTier: "STANDARD",
      licenseSchool: "",
      licenseType: "",
      licenseNumber: "",
    });

    assert.deepEqual(result, {
      ok: true,
      id: "reservation-1",
      requiredUnits: 2,
      readyCount: 2,
    });
    assert.equal(requestedUrl, "/api/store/reservations/reservation-1/formalize");
    assert.equal(requestedInit?.method, "POST");

    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as {
      items?: Array<{ quantity?: number }>;
    };
    assert.equal(body.items?.[0]?.quantity, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
