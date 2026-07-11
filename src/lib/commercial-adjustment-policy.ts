export type CommercialAdjustmentOperationType = "EDIT" | "CANCEL";

export type CommercialAdjustmentRefundMode = "refundNow" | "leavePendingRefund";
export type CommercialAdjustmentRefundScope = "SERVICE" | "DEPOSIT" | "FULL" | "NONE";

export type CommercialAdjustmentPolicyBlocker =
  | "ADVANCED_RESERVATION_STATUS"
  | "CANCEL_REASON_REQUIRED"
  | "PAID_COMMISSION"
  | "REFUND_NOW_NOT_SUPPORTED_B3A"
  | "REFUND_MODE_REQUIRED"
  | "REFUND_REASON_REQUIRED"
  | "SIGNED_CONTRACT_MATERIAL_EDIT"
  | "VOUCHER_OR_PASS_OR_GIFT";

export type CommercialAdjustmentPolicyWarning =
  | "DEPOSIT_PAYMENT_UNCHANGED"
  | "DEPOSIT_HELD_NOT_REFUNDED"
  | "PAYMENT_HISTORY_PRESERVED"
  | "PENDING_COMMISSION_RECALCULATION"
  | "SIGNED_CONTRACT_HISTORY_PRESERVED";

export type CommercialAdjustmentRequiredAction =
  | "COLLECT_PENDING_SERVICE"
  | "KEEP_PAYMENT_HISTORY"
  | "KEEP_SIGNED_CONTRACT_HISTORY"
  | "LEAVE_PENDING_REFUND"
  | "RECALCULATE_COMMERCIAL_TOTAL"
  | "RECALCULATE_PENDING_COMMISSION"
  | "REFUND_NOW"
  | "REVIEW_VOUCHER_OR_PASS_OR_GIFT";

export type ResolveCommercialAdjustmentPolicyArgs = {
  oldTotalCents: number | null | undefined;
  newTotalCents: number | null | undefined;
  paidServiceCents: number | null | undefined;
  paidDepositCents: number | null | undefined;
  hasSignedContracts: boolean;
  reservationStatus: string | null | undefined;
  hasPaidCommission: boolean;
  hasPendingCommission: boolean;
  hasVoucherOrPassOrGift: boolean;
  requestedRefundMode?: CommercialAdjustmentRefundMode | null;
  refundScope?: CommercialAdjustmentRefundScope | null;
  reason?: string | null;
  operationType: CommercialAdjustmentOperationType;
  phase?: "B3A" | "B3B" | null;
};

export type CommercialAdjustmentPolicy = {
  canCommit: boolean;
  blockers: CommercialAdjustmentPolicyBlocker[];
  warnings: CommercialAdjustmentPolicyWarning[];
  pendingServiceCents: number;
  overpaidServiceCents: number;
  refundNowCents: number;
  pendingRefundCents: number;
  requiredActions: CommercialAdjustmentRequiredAction[];
};

const ADVANCED_RESERVATION_STATUSES = new Set(["IN_SEA", "COMPLETED", "CANCELED"]);

function normalizeCents(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function hasReason(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

function pushUnique<T>(items: T[], item: T) {
  if (!items.includes(item)) items.push(item);
}

function normalizeRefundScope(
  value: CommercialAdjustmentRefundScope | null | undefined
): CommercialAdjustmentRefundScope {
  if (value === "SERVICE" || value === "DEPOSIT" || value === "FULL" || value === "NONE") {
    return value;
  }
  return "FULL";
}

export function resolveCommercialAdjustmentPolicy(
  args: ResolveCommercialAdjustmentPolicyArgs
): CommercialAdjustmentPolicy {
  const oldTotalCents = normalizeCents(args.oldTotalCents);
  const newTotalCents = normalizeCents(args.newTotalCents);
  const paidServiceCents = normalizeCents(args.paidServiceCents);
  const paidDepositCents = normalizeCents(args.paidDepositCents);
  const status = normalizeStatus(args.reservationStatus);
  const materialTotalChange = oldTotalCents !== newTotalCents;
  const hasAnyPayment = paidServiceCents > 0 || paidDepositCents > 0;
  const refundScope = normalizeRefundScope(args.refundScope);
  const serviceInRefundScope = refundScope === "SERVICE" || refundScope === "FULL";
  const refundNowBlockedInB3A =
    args.phase === "B3A" && args.requestedRefundMode === "refundNow";

  const pendingServiceCents = Math.max(0, newTotalCents - paidServiceCents);
  const overpaidServiceCents = Math.max(0, paidServiceCents - newTotalCents);
  let refundNowCents = 0;
  let pendingRefundCents = 0;

  const blockers: CommercialAdjustmentPolicyBlocker[] = [];
  const warnings: CommercialAdjustmentPolicyWarning[] = [];
  const requiredActions: CommercialAdjustmentRequiredAction[] = [];

  if (materialTotalChange) {
    requiredActions.push("RECALCULATE_COMMERCIAL_TOTAL");
  }

  if (hasAnyPayment) {
    warnings.push("PAYMENT_HISTORY_PRESERVED");
    requiredActions.push("KEEP_PAYMENT_HISTORY");
  }

  if (paidDepositCents > 0) {
    warnings.push("DEPOSIT_PAYMENT_UNCHANGED");
  }

  if (pendingServiceCents > 0) {
    requiredActions.push("COLLECT_PENDING_SERVICE");
  }

  if (overpaidServiceCents > 0 && serviceInRefundScope) {
    if (args.requestedRefundMode === "refundNow") {
      refundNowCents = overpaidServiceCents;
      requiredActions.push("REFUND_NOW");
      if (refundNowBlockedInB3A) {
        blockers.push("REFUND_NOW_NOT_SUPPORTED_B3A");
      } else if (!hasReason(args.reason)) {
        blockers.push("REFUND_REASON_REQUIRED");
      }
    } else if (args.requestedRefundMode === "leavePendingRefund") {
      pendingRefundCents = overpaidServiceCents;
      requiredActions.push("LEAVE_PENDING_REFUND");
    } else {
      blockers.push("REFUND_MODE_REQUIRED");
    }
  }

  if (refundNowBlockedInB3A && overpaidServiceCents === 0) {
    blockers.push("REFUND_NOW_NOT_SUPPORTED_B3A");
  }

  if (args.operationType === "CANCEL" && !hasReason(args.reason)) {
    blockers.push("CANCEL_REASON_REQUIRED");
  }

  if (
    args.hasSignedContracts &&
    args.operationType === "EDIT"
  ) {
    blockers.push("SIGNED_CONTRACT_MATERIAL_EDIT");
  }

  if (args.hasSignedContracts && args.operationType === "CANCEL") {
    warnings.push("SIGNED_CONTRACT_HISTORY_PRESERVED");
    pushUnique(requiredActions, "KEEP_SIGNED_CONTRACT_HISTORY");
  }

  if (args.hasPaidCommission) {
    blockers.push("PAID_COMMISSION");
  }

  if (ADVANCED_RESERVATION_STATUSES.has(status)) {
    blockers.push("ADVANCED_RESERVATION_STATUS");
  }

  if (args.hasVoucherOrPassOrGift) {
    blockers.push("VOUCHER_OR_PASS_OR_GIFT");
    requiredActions.push("REVIEW_VOUCHER_OR_PASS_OR_GIFT");
  }

  if (args.hasPendingCommission && materialTotalChange) {
    warnings.push("PENDING_COMMISSION_RECALCULATION");
    requiredActions.push("RECALCULATE_PENDING_COMMISSION");
  }

  return {
    canCommit: blockers.length === 0,
    blockers,
    warnings,
    pendingServiceCents,
    overpaidServiceCents,
    refundNowCents,
    pendingRefundCents,
    requiredActions,
  };
}
