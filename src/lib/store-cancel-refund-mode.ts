import { type CommercialAdjustmentCommitProposal } from "./commercial-adjustment-commit";

export type StoreCancelLegacyRefundMode = "NONE" | "SERVICE" | "FULL";

export function requestedRefundModeForStoreCancel(body: {
  refundMode?: StoreCancelLegacyRefundMode | null;
  requestedRefundMode?: CommercialAdjustmentCommitProposal["requestedRefundMode"];
}): CommercialAdjustmentCommitProposal["requestedRefundMode"] {
  if (body.requestedRefundMode) return body.requestedRefundMode;
  if (body.refundMode === "FULL" || body.refundMode === "SERVICE") return "refundNow";
  if (body.refundMode === "NONE") return "leavePendingRefund";
  return "none";
}
