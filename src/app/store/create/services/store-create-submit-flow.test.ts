import assert from "node:assert/strict";
import test from "node:test";

import { submitStoreCreateEditFlow, submitStoreCreateMigrateFlow } from "./store-create-submit-flow";

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

test("formalize de regalo no envia composicion ni campos comerciales congelados", async () => {
  const originalFetch = globalThis.fetch;
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "gift-reservation-1",
        requiredUnits: 1,
        readyCount: 1,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateMigrateFlow({
      migrateReservationId: "gift-reservation-1",
      customerName: "Laura",
      quantity: 9,
      pax: 9,
      isVoucherFormalizeFlow: true,
      serviceId: "service-ui-default",
      optionId: "option-ui-default",
      channelId: "direct-channel",
      cartItemsLength: 1,
      canCreate: false,
      uiMode: "FORMALIZE",
      dateStr: "2026-07-03",
      todayYmd: "2026-07-03",
      cartItems: [
        {
          serviceId: "service-ui-default",
          optionId: "option-ui-default",
          quantity: 9,
          pax: 9,
        },
      ],
      customerPhone: "600000000",
      customerEmail: "",
      customerCountry: "ES",
      customerAddress: "",
      customerPostalCode: "",
      customerBirthDate: "",
      customerDocType: "",
      customerDocNumber: "",
      marketingSource: "",
      companions: 4,
      timeStr: "10:00",
      isLicense: true,
      jetskiLicenseMode: "YELLOW_UNLIMITED",
      pricingTier: "STANDARD",
      licenseSchool: "Escuela",
      licenseType: "PER",
      licenseNumber: "123",
    });

    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as Record<string, unknown>;
    assert.equal("items" in body, false);
    assert.equal("serviceId" in body, false);
    assert.equal("optionId" in body, false);
    assert.equal("quantity" in body, false);
    assert.equal("pax" in body, false);
    assert.equal("channelId" in body, false);
    assert.equal("companionsCount" in body, false);
    assert.equal("isLicense" in body, false);
    assert.equal("jetskiLicenseMode" in body, false);
    assert.equal("pricingTier" in body, false);
    assert.equal("giftCode" in body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sync previo de regalo usa payload solo fecha hora y no puede recalcular ni consumir voucher", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "gift-reservation-1",
        requiredUnits: 1,
        readyCount: 1,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateEditFlow({
      editReservationId: "gift-reservation-1",
      customerName: "Laura",
      quantity: 9,
      pax: 9,
      isVoucherFormalizeFlow: true,
      serviceId: "service-ui-default",
      optionId: "option-ui-default",
      channelId: "direct-channel",
      cartItemsLength: 1,
      canCreate: false,
      uiMode: "FORMALIZE",
      dateStr: "2026-07-03",
      todayYmd: "2026-07-03",
      isLicense: true,
      jetskiLicenseMode: "YELLOW_UNLIMITED",
      pricingTier: "STANDARD",
      timeStr: "10:00",
      companions: 4,
      cartItems: [
        {
          serviceId: "service-ui-default",
          optionId: "option-ui-default",
          quantity: 9,
          pax: 9,
        },
      ],
      customerPhone: "600000000",
      customerEmail: "",
      customerCountry: "ES",
      customerAddress: "",
      customerPostalCode: "",
      customerBirthDate: "",
      customerDocType: "",
      customerDocNumber: "",
      marketingSource: "",
      licenseSchool: "Escuela",
      licenseType: "PER",
      licenseNumber: "123",
    });

    assert.equal(requestedUrl, "/api/store/reservations/gift-reservation-1/update");
    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as Record<string, unknown>;
    assert.deepEqual(body, {
      activityDate: "2026-07-03",
      time: "10:00",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
