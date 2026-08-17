import assert from "node:assert/strict";
import test from "node:test";

import { JetskiLicenseMode, PricingTier } from "@prisma/client";

import {
  deriveReservationItemSetCommercialCategory,
  deriveReservationItemSetCommercialState,
  selectReservationCompatMainLine,
} from "./reservation-item-semantics";

const jetski20 = { serviceId: "svc-jetski", optionId: "opt-jetski-20", category: "JETSKI" };
const jetski30 = { serviceId: "svc-jetski", optionId: "opt-jetski-30", category: "JETSKI" };
const banana15 = { serviceId: "svc-banana", optionId: "opt-banana-15", category: "TOWABLE" };

function commercialState(lines: Array<typeof jetski20>) {
  return deriveReservationItemSetCommercialState({
    lines,
    jetskiLicenseMode: JetskiLicenseMode.GREEN_LIMITED,
    isLicense: true,
    pricingTier: PricingTier.STANDARD,
  });
}

test("Jetski + Banana y Banana + Jetski derivan el mismo estado comercial agregado", () => {
  const jetskiFirst = commercialState([jetski20, banana15]);
  const bananaFirst = commercialState([banana15, jetski20]);

  assert.deepEqual(jetskiFirst, bananaFirst);
  assert.deepEqual(jetskiFirst, {
    jetskiLicenseMode: JetskiLicenseMode.GREEN_LIMITED,
    isLicense: true,
    pricingTier: PricingTier.RESIDENT,
  });
});

test("el ancla compat no depende del orden de entrada", () => {
  const jetskiFirst = selectReservationCompatMainLine([jetski20, banana15]);
  const bananaFirst = selectReservationCompatMainLine([banana15, jetski20]);

  assert.equal(jetskiFirst?.serviceId, "svc-jetski");
  assert.equal(bananaFirst?.serviceId, "svc-jetski");
});

test("dos Jetski con opciones distintas seleccionan un ancla determinista", () => {
  const first = selectReservationCompatMainLine([jetski30, jetski20]);
  const second = selectReservationCompatMainLine([jetski20, jetski30]);

  assert.equal(first?.optionId, "opt-jetski-20");
  assert.equal(second?.optionId, "opt-jetski-20");
  assert.deepEqual(commercialState([jetski30, jetski20]), commercialState([jetski20, jetski30]));
});

test("los pack parents no ocultan componentes Jetski reales", () => {
  const packParent = {
    serviceId: "svc-pack",
    optionId: "opt-pack",
    category: "PACK",
    isPackParent: true,
  };
  const state = deriveReservationItemSetCommercialState({
    lines: [packParent, banana15, jetski20],
    isLicense: true,
  });

  assert.equal(state.jetskiLicenseMode, JetskiLicenseMode.YELLOW_UNLIMITED);
  assert.equal(state.isLicense, true);
  assert.equal(selectReservationCompatMainLine([packParent, banana15, jetski20])?.serviceId, "svc-jetski");
});

test("la categoria comercial agregada usa Jetski si cualquier item real lo contiene", () => {
  assert.equal(
    deriveReservationItemSetCommercialCategory([banana15, jetski20], "TOWABLE"),
    "JETSKI"
  );
  assert.equal(
    deriveReservationItemSetCommercialCategory([banana15], "BOAT"),
    "TOWABLE"
  );
});
