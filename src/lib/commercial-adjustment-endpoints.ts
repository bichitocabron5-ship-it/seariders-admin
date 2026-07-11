import { type CommercialAdjustmentOperationType } from "./commercial-adjustment-policy";

export const GENERIC_COMMIT_CANCEL_ERROR =
  "operationType=CANCEL debe ejecutarse desde /api/store/reservations/[id]/cancel.";

export function validateGenericCommercialAdjustmentCommitOperation(
  operationType: CommercialAdjustmentOperationType
) {
  if (operationType === "CANCEL") {
    return {
      ok: false as const,
      status: 409,
      error: GENERIC_COMMIT_CANCEL_ERROR,
    };
  }

  return { ok: true as const };
}
