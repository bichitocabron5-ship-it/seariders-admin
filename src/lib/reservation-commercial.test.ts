import test from "node:test";
import assert from "node:assert/strict";

import {
  computeReservationCommercialBreakdown,
} from "./reservation-commercial";
import { finalizeReservationCommercialBreakdown } from "./reservation-commercial-breakdown";

test("no discount keeps final total and commission base on the gross price", () => {
  const result = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    autoDiscountCents: 0,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 10_000);
  assert.equal(result.totalDiscountCents, 0);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 0);
});

test("manual discount with COMPANY responsibility keeps promoter commission on the gross price", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 1_500);
});

test("manual discount with PROMOTER responsibility reduces promoter commission base", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "PROMOTER",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 8_500);
  assert.equal(result.promoterDiscountCents, 1_500);
  assert.equal(result.companyDiscountCents, 0);
});

test("manual discount with SHARED responsibility reduces only promoter share from commission base", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 0,
    manualDiscountCents: 1_500,
    discountResponsibility: "SHARED",
    promoterDiscountShareBps: 4_000,
  });

  assert.equal(result.finalTotalCents, 8_500);
  assert.equal(result.commissionBaseCents, 9_400);
  assert.equal(result.promoterDiscountCents, 600);
  assert.equal(result.companyDiscountCents, 900);
});

test("regresion comercial: descuento COMPANY de 10 mantiene la comision del promotor sobre 100", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_000,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 9_000);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 1_000);
});

test("regresion comercial: descuento PROMOTER de 10 baja la base comisionable a 90", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_000,
    manualDiscountCents: 0,
    discountResponsibility: "PROMOTER",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 9_000);
  assert.equal(result.commissionBaseCents, 9_000);
  assert.equal(result.promoterDiscountCents, 1_000);
  assert.equal(result.companyDiscountCents, 0);
});

test("regresion comercial: descuento SHARED de 10 al 50% deja base comisionable 95", async () => {
  const result = await computeReservationCommercialBreakdown({
    when: new Date("2026-05-12T10:00:00Z"),
    discountLines: [],
    customerCountry: "ES",
    promotionsEnabled: false,
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_000,
    manualDiscountCents: 0,
    discountResponsibility: "SHARED",
    promoterDiscountShareBps: 5_000,
  });

  assert.equal(result.finalTotalCents, 9_000);
  assert.equal(result.commissionBaseCents, 9_500);
  assert.equal(result.promoterDiscountCents, 500);
  assert.equal(result.companyDiscountCents, 500);
});

test("channel or automatic discounts keep promoter commission on gross when company assumes them", () => {
  const result = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_500,
    autoDiscountCents: 500,
    manualDiscountCents: 0,
    discountResponsibility: "COMPANY",
    promoterDiscountShareBps: 0,
  });

  assert.equal(result.finalTotalCents, 8_000);
  assert.equal(result.totalDiscountCents, 2_000);
  assert.equal(result.commissionBaseCents, 10_000);
  assert.equal(result.promoterDiscountCents, 0);
  assert.equal(result.companyDiscountCents, 2_000);
});

test("channel or automatic discounts reduce promoter commission base when promoter assumes them", () => {
  const result = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: 10_000,
    customerDiscountCents: 1_500,
    autoDiscountCents: 500,
    manualDiscountCents: 0,
    discountResponsibility: "PROMOTER",
    promoterDiscountShareBps: 10_000,
  });

  assert.equal(result.finalTotalCents, 8_000);
  assert.equal(result.totalDiscountCents, 2_000);
  assert.equal(result.commissionBaseCents, 8_000);
  assert.equal(result.promoterDiscountCents, 2_000);
  assert.equal(result.companyDiscountCents, 0);
});
