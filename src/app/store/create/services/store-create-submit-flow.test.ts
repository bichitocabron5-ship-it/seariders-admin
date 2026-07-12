import assert from "node:assert/strict";
import test from "node:test";

import { submitStoreCreateCreateFlow, submitStoreCreateEditFlow, submitStoreCreateMigrateFlow } from "./store-create-submit-flow";

function createRouterProbe() {
  let pushedUrl = "";
  const router = {
    push(url: string) {
      pushedUrl = url;
    },
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
  } as Parameters<typeof submitStoreCreateCreateFlow>[0]["router"];

  return {
    router,
    get pushedUrl() {
      return pushedUrl;
    },
  };
}

function baseCreateArgs(router: Parameters<typeof submitStoreCreateCreateFlow>[0]["router"]) {
  return {
    customerName: "Laura",
    quantity: 1,
    pax: 2,
    isVoucherFormalizeFlow: false,
    serviceId: "service-1",
    optionId: "option-1",
    channelId: "channel-1",
    cartItemsLength: 0,
    canCreate: true,
    uiMode: "CREATE" as const,
    dateStr: "2026-07-03",
    todayYmd: "2026-07-02",
    isPackMode: false,
    cartItems: [],
    timeStr: "10:00",
    customerPhone: "600000000",
    customerEmail: "",
    customerCountry: "ES",
    customerAddress: "",
    customerPostalCode: "",
    customerBirthDate: "",
    customerDocType: "",
    customerDocNumber: "",
    marketingSource: "",
    isLicense: false,
    jetskiLicenseMode: "NONE" as const,
    pricingTier: "STANDARD" as const,
    licenseSchool: "",
    licenseType: "",
    licenseNumber: "",
    companions: 0,
    manualDiscountCents: 0,
    manualDiscountReason: "",
    discountResponsibility: "COMPANY" as const,
    promoterDiscountShareBps: 0,
    router,
  };
}

test("create submit en modo pack envia packId y no componentes calculados por frontend", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const routerProbe = createRouterProbe();

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "reservation-pack-1",
        autoFormalized: false,
        requiredContractUnits: 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateCreateFlow({
      ...baseCreateArgs(routerProbe.router),
      isPackMode: true,
      packId: "pack-jetski-banana",
      serviceId: "pack-service",
      optionId: "pack-option",
      quantity: 1,
      pax: 2,
    });

    assert.equal(requestedUrl, "/api/store/reservations/create");
    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as {
      packId?: string;
      totalBeforeDiscountsCents?: number;
      items?: Array<{ serviceId?: string; optionId?: string; quantity?: number; pax?: number }>;
    };
    assert.equal(body.packId, "pack-jetski-banana");
    assert.equal("totalBeforeDiscountsCents" in body, false);
    assert.deepEqual(body.items, [
      {
        serviceId: "pack-service",
        optionId: "pack-option",
        quantity: 1,
        pax: 2,
        promoCode: null,
      },
    ]);
    assert.equal(routerProbe.pushedUrl, "/store/create?editFrom=reservation-pack-1#payments");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("create submit con carrito conserva todas las lineas reales y descuentos por linea", async () => {
  const originalFetch = globalThis.fetch;
  let requestedInit: RequestInit | undefined;
  const routerProbe = createRouterProbe();

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "reservation-cart-1",
        autoFormalized: true,
        requiredContractUnits: 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateCreateFlow({
      ...baseCreateArgs(routerProbe.router),
      cartItemsLength: 2,
      manualDiscountCents: 1_000,
      manualDiscountReason: "Ajuste comercial",
      cartItems: [
        {
          serviceId: "banana-service",
          optionId: "banana-15",
          quantity: 1,
          pax: 2,
          promoCode: "SUMMER",
        },
        {
          serviceId: "jetski-service",
          optionId: "jetski-20",
          quantity: 2,
          pax: 2,
          promoCode: null,
        },
      ],
    });

    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as Record<string, unknown>;
    assert.equal("packId" in body, false);
    assert.equal(body.manualDiscountCents, 1_000);
    assert.equal(body.manualDiscountReason, "Ajuste comercial");
    assert.deepEqual(body.items, [
      {
        serviceId: "banana-service",
        optionId: "banana-15",
        quantity: 1,
        pax: 2,
        promoCode: "SUMMER",
      },
      {
        serviceId: "jetski-service",
        optionId: "jetski-20",
        quantity: 2,
        pax: 2,
        promoCode: null,
      },
    ]);
    assert.equal(routerProbe.pushedUrl, "/store/create?editFrom=reservation-cart-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("create submit simple sigue enviando una unica linea", async () => {
  const originalFetch = globalThis.fetch;
  let requestedInit: RequestInit | undefined;
  const routerProbe = createRouterProbe();

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "reservation-simple-1",
        autoFormalized: true,
        requiredContractUnits: 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateCreateFlow({
      ...baseCreateArgs(routerProbe.router),
      serviceId: "banana-service",
      optionId: "banana-15",
      quantity: 1,
      pax: 2,
    });

    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as Record<string, unknown>;
    assert.equal("packId" in body, false);
    assert.deepEqual(body.items, [
      {
        serviceId: "banana-service",
        optionId: "banana-15",
        quantity: 1,
        pax: 2,
        promoCode: null,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test("edit submit no envia descuento manual para que backend proratee el snapshot guardado", async () => {
  const originalFetch = globalThis.fetch;
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestedInit = init;

    return new Response(
      JSON.stringify({
        ok: true,
        id: "reservation-1",
        requiredUnits: 1,
        readyCount: 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    await submitStoreCreateEditFlow({
      editReservationId: "reservation-1",
      customerName: "Laura",
      quantity: 1,
      pax: 1,
      isVoucherFormalizeFlow: false,
      serviceId: "service-1",
      optionId: "option-1",
      channelId: "channel-1",
      cartItemsLength: 1,
      canCreate: true,
      uiMode: "EDIT",
      dateStr: "2026-07-03",
      todayYmd: "2026-07-03",
      isLicense: false,
      jetskiLicenseMode: "NONE",
      pricingTier: "STANDARD",
      timeStr: "10:00",
      companions: 0,
      cartItems: [
        {
          serviceId: "service-1",
          optionId: "option-1",
          quantity: 1,
          pax: 1,
          promoCode: "MAYO",
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
      licenseSchool: "",
      licenseType: "",
      licenseNumber: "",
    });

    const body = JSON.parse(String(requestedInit?.body ?? "{}")) as Record<string, unknown>;
    assert.equal("manualDiscountCents" in body, false);
    assert.deepEqual(body.items, [
      {
        serviceId: "service-1",
        optionId: "option-1",
        quantity: 1,
        pax: 1,
        promoCode: "MAYO",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
