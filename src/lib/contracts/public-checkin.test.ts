import assert from "node:assert/strict";
import test from "node:test";

import { evaluateContractCheckinState } from "./public-checkin";

const completeBaseContract = {
  driverName: "Laura Perez",
  driverCountry: "ES",
  driverAddress: "Calle Mar 1",
  driverDocType: "DNI",
  driverDocNumber: "12345678A",
  driverBirthDate: "1990-01-01T00:00:00.000Z",
};

test("precheckin con licencia completa puede quedar listo para firma", () => {
  const result = evaluateContractCheckinState({
    isLicense: true,
    status: "DRAFT",
    language: "es",
    contract: {
      ...completeBaseContract,
      licenseSchool: "Escuela Nautica",
      licenseType: "PER",
      licenseNumber: "ABC123",
    },
  });

  assert.equal(result.canBeReady, true);
  assert.equal(result.nextStatus, "READY");
  assert.deepEqual(result.blockingFields, []);
});

test("precheckin con licencia sin numero indica licenseNumber", () => {
  const result = evaluateContractCheckinState({
    isLicense: true,
    status: "DRAFT",
    language: "es",
    contract: {
      ...completeBaseContract,
      licenseSchool: "Escuela Nautica",
      licenseType: "PER",
      licenseNumber: "",
    },
  });

  assert.equal(result.canBeReady, false);
  assert.deepEqual(result.blockingFields, ["licenseNumber"]);
  assert.match(result.blockingReason ?? "", /numero de licencia/);
});

test("precheckin sin licencia no exige campos de licencia", () => {
  const result = evaluateContractCheckinState({
    isLicense: false,
    status: "DRAFT",
    language: "es",
    contract: {
      ...completeBaseContract,
      licenseSchool: "",
      licenseType: "",
      licenseNumber: "",
    },
  });

  assert.equal(result.canBeReady, true);
  assert.equal(result.nextStatus, "READY");
  assert.deepEqual(result.blockingFields, []);
});

test("precheckin no exige telefono del conductor para quedar listo", () => {
  const result = evaluateContractCheckinState({
    isLicense: false,
    status: "DRAFT",
    language: "es",
    contract: {
      ...completeBaseContract,
      driverPhone: "",
    },
  });

  assert.equal(result.canBeReady, true);
  assert.equal(result.nextStatus, "READY");
  assert.deepEqual(result.blockingFields, []);
});

test("precheckin exige pais del conductor para quedar listo", () => {
  const result = evaluateContractCheckinState({
    isLicense: false,
    status: "DRAFT",
    language: "es",
    contract: {
      ...completeBaseContract,
      driverCountry: "",
    },
  });

  assert.equal(result.canBeReady, false);
  assert.deepEqual(result.blockingFields, ["driverCountry"]);
  assert.match(result.blockingReason ?? "", /pais del conductor/);
});

test("precheckin en frances localiza campos obligatorios", () => {
  const result = evaluateContractCheckinState({
    isLicense: true,
    status: "DRAFT",
    language: "fr",
    contract: {
      ...completeBaseContract,
      licenseSchool: "Ecole Nautique",
      licenseType: "PER",
      licenseNumber: "",
    },
  });

  assert.equal(result.canBeReady, false);
  assert.deepEqual(result.blockingFields, ["licenseNumber"]);
  assert.match(result.blockingReason ?? "", /numero de permis/);
});
