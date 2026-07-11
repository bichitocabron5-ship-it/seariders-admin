import { type CommercialAdjustmentCommitProposal } from "./commercial-adjustment-commit";

export type StoreCancelLegacyRefundMode = "NONE" | "SERVICE" | "FULL";
export type StoreCancelRefundScope = NonNullable<CommercialAdjustmentCommitProposal["refundScope"]>;
export type StoreCancelRefundSelection = {
  requestedRefundMode: CommercialAdjustmentCommitProposal["requestedRefundMode"];
  refundScope: StoreCancelRefundScope;
};

export function refundSelectionForStoreCancel(body: {
  refundMode?: StoreCancelLegacyRefundMode | null;
  requestedRefundMode?: CommercialAdjustmentCommitProposal["requestedRefundMode"];
  refundScope?: StoreCancelRefundScope | null;
}): StoreCancelRefundSelection {
  if (body.requestedRefundMode) {
    return {
      requestedRefundMode: body.requestedRefundMode,
      refundScope: body.refundScope ?? "FULL",
    };
  }
  if (body.refundMode === "SERVICE") {
    return { requestedRefundMode: "refundNow", refundScope: "SERVICE" };
  }
  if (body.refundMode === "FULL") {
    return { requestedRefundMode: "refundNow", refundScope: "FULL" };
  }
  if (body.refundMode === "NONE") {
    return { requestedRefundMode: "none", refundScope: "NONE" };
  }
  return { requestedRefundMode: "none", refundScope: "FULL" };
}

export function requestedRefundModeForStoreCancel(body: {
  refundMode?: StoreCancelLegacyRefundMode | null;
  requestedRefundMode?: CommercialAdjustmentCommitProposal["requestedRefundMode"];
}): CommercialAdjustmentCommitProposal["requestedRefundMode"] {
  return refundSelectionForStoreCancel(body).requestedRefundMode;
}
