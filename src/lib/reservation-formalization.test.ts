import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissingLicenseError,
  resolveReservationLicenseDetails,
} from "./reservation-formalization";

test("la licencia firmada en contrato no se pisa por campos vacios top-level", () => {
  const result = resolveReservationLicenseDetails({
    isLicense: true,
    body: {
      licenseSchool: "",
      licenseType: " ",
      licenseNumber: null,
    },
    current: {
      licenseSchool: null,
      licenseType: null,
      licenseNumber: null,
    },
    visibleContracts: [
      {
        unitIndex: 1,
        logicalUnitIndex: 1,
        driverName: "Laura",
        licenseSchool: "Escuela Nautica",
        licenseType: "PER",
        licenseNumber: "ABC123",
      },
    ],
    primaryContract: null,
  });

  assert.equal(result.licenseSchool, "Escuela Nautica");
  assert.equal(result.licenseType, "PER");
  assert.equal(result.licenseNumber, "ABC123");
  assert.equal(result.missingContractMessage, null);
  assert.equal(result.isComplete, true);
});

test("contrato firmado con licencia completa valida OK", () => {
  const result = resolveReservationLicenseDetails({
    isLicense: true,
    body: {},
    current: {},
    visibleContracts: [
      {
        unitIndex: 1,
        logicalUnitIndex: 1,
        driverName: "Marcos",
        licenseSchool: "Escuela del Mar",
        licenseType: "PNB",
        licenseNumber: "9999",
      },
    ],
    primaryContract: null,
  });

  assert.equal(result.missingContractMessage, null);
  assert.equal(result.isComplete, true);
});

test("contrato con licencia incompleta devuelve campos faltantes", () => {
  const error = buildMissingLicenseError({
    unitIndex: 2,
    logicalUnitIndex: 2,
    driverName: "Ana",
    licenseSchool: "Escuela del Mar",
    licenseType: null,
    licenseNumber: "",
  });

  assert.equal(
    error,
    "Faltan datos de licencia en el contrato de la unidad 2 (Ana): tipo, numero."
  );
});
