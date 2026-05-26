import assert from "node:assert/strict";
import test from "node:test";

import { getReservationWorkflowState } from "./reservation-workflow";

test("reserva formalizada con servicio pendiente queda marcada pendiente de cobro", () => {
  const workflow = getReservationWorkflowState({
    reservationId: "res-1",
    status: "WAITING",
    formalizedAt: "2026-05-26T10:00:00.000Z",
    customerName: "Laura",
    customerPhone: "600000000",
    pendingServiceCents: 4_000,
    pendingDepositCents: 0,
  });

  assert.equal(workflow.visibleState, "formalized");
  assert.equal(workflow.label, "Formalizada pendiente de cobro");
  assert.equal(workflow.primaryAction.kind, "payments");
  assert.deepEqual(workflow.missingRequirements, ["Queda servicio pendiente de cobro."]);
});
