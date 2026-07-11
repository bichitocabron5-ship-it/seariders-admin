export type CancelRefundMode = "refundNow" | "leavePendingRefund" | "none";
export type CancelRefundScope = "SERVICE" | "DEPOSIT" | "FULL";

export type CancelRefundSubmit = {
  requestedRefundMode: CancelRefundMode;
  refundScope: CancelRefundScope;
};

function refundableCents(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

export function refundScopeForRefundableAmounts(args: {
  refundableServiceCents: number | null | undefined;
  refundableDepositCents: number | null | undefined;
}): CancelRefundScope {
  const refundableServiceCents = refundableCents(args.refundableServiceCents);
  const refundableDepositCents = refundableCents(args.refundableDepositCents);
  if (refundableServiceCents > 0 && refundableDepositCents > 0) return "FULL";
  if (refundableDepositCents > 0) return "DEPOSIT";
  return "SERVICE";
}

export function resolveCancelRefundSubmit(args: {
  selectedRefundMode: CancelRefundMode;
  refundableServiceCents: number | null | undefined;
  refundableDepositCents: number | null | undefined;
}): CancelRefundSubmit {
  const refundableServiceCents = refundableCents(args.refundableServiceCents);
  const refundableDepositCents = refundableCents(args.refundableDepositCents);
  const hasRefundableAmount = refundableServiceCents + refundableDepositCents > 0;

  if (
    hasRefundableAmount &&
    (args.selectedRefundMode === "refundNow" || args.selectedRefundMode === "leavePendingRefund")
  ) {
    return {
      requestedRefundMode: args.selectedRefundMode,
      refundScope: refundScopeForRefundableAmounts({
        refundableServiceCents,
        refundableDepositCents,
      }),
    };
  }

  return {
    requestedRefundMode: "none",
    refundScope: "FULL",
  };
}
