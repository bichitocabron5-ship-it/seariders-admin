import assert from "node:assert/strict";
import test from "node:test";

import {
  canProceedPastContracts,
  contractProgressMessage,
  missingContractProgressMessage,
} from "./store-create-contract-progress";

test("no avanza a pagos si contratos no se refrescaron realmente", () => {
  assert.equal(
    canProceedPastContracts({ requiredUnits: 0, readyCount: 0, refreshed: false }),
    false
  );
});

test("permite avanzar si no hay contratos requeridos tras refresco", () => {
  assert.equal(
    canProceedPastContracts({ requiredUnits: 0, readyCount: 0, refreshed: true }),
    true
  );
  assert.equal(contractProgressMessage({ requiredUnits: 0, readyCount: 0 }), "Esta actividad no requiere contratos.");
});

test("mantiene pantalla de contratos mientras falten unidades activas", () => {
  const progress = { requiredUnits: 2, readyCount: 1, refreshed: true };

  assert.equal(canProceedPastContracts(progress), false);
  assert.equal(missingContractProgressMessage(progress), "Faltan contratos por completar: 1/2 listos.");
});

test("permite avanzar cuando todos los contratos activos están listos", () => {
  const progress = { requiredUnits: 2, readyCount: 2, refreshed: true };

  assert.equal(canProceedPastContracts(progress), true);
  assert.equal(contractProgressMessage(progress), "Contratos sincronizados: 2/2.");
});
