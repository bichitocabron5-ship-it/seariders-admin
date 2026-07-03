export type CommercialSnapshotLike = {
  giftVoucherId?: string | null;
  passVoucherId?: string | null;
  passConsumeId?: string | null;
  pvpTotalCents?: number | null;
  basePriceCents?: number | null;
  totalPriceCents?: number | null;
  autoDiscountCents?: number | null;
  manualDiscountCents?: number | null;
  customerDiscountCents?: number | null;
  promoCode?: string | null;
  commissionBaseCents?: number | null;
  appliedCommissionMode?: string | null;
  appliedCommissionPct?: number | null;
  appliedCommissionValue?: number | null;
  appliedCommissionCents?: number | null;
  promoterDiscountCents?: number | null;
  companyDiscountCents?: number | null;
  items?: Array<{
    isExtra?: boolean | null;
    unitPriceCents?: number | null;
    totalPriceCents?: number | null;
  }> | null;
};

export type PaymentSnapshotLike = {
  amountCents?: number | null;
  isDeposit?: boolean | null;
  direction?: string | null;
};

export type CommercialCommitmentBlocker =
  | "FORMALIZED"
  | "OPERATIONAL_STATUS"
  | "PAYMENT"
  | "PREPAID_VOUCHER"
  | "SIGNED_CONTRACT"
  | "COMMISSION_PAID";

export type CommercialCommitmentArgs = {
  status?: string | null;
  formalizedAt?: Date | string | null;
  snapshot: {
    giftVoucherId?: string | null;
    passVoucherId?: string | null;
    passConsumeId?: string | null;
  };
  payments?: PaymentSnapshotLike[] | null;
  signedContractsCount?: number | null;
  contracts?: Array<{ status?: string | null }> | null;
  commissionLines?: Array<{ status?: string | null }> | null;
};

export type CommercialPricingStateLike = {
  serviceCategory?: string | null;
  isLicense?: boolean | null;
  jetskiLicenseMode?: string | null;
  pricingTier?: string | null;
};

function isFiniteCents(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function isFiniteNullableNumber(value: unknown) {
  if (value == null) return true;
  return Number.isFinite(Number(value));
}

export function isReservationCoveredByPrepaidVoucher(snapshot: {
  giftVoucherId?: string | null;
  passVoucherId?: string | null;
  passConsumeId?: string | null;
}) {
  return Boolean(snapshot.giftVoucherId || snapshot.passVoucherId || snapshot.passConsumeId);
}

export function voucherCoveredServiceDueCents(args: {
  items?: Array<{
    isExtra?: boolean | null;
    totalPriceCents?: number | null;
  }> | null;
}) {
  return (args.items ?? [])
    .filter((item) => Boolean(item.isExtra))
    .reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.totalPriceCents ?? 0))), 0);
}

export function resolveChargeableServiceDueCents(
  args: CommercialSnapshotLike
) {
  if (isReservationCoveredByPrepaidVoucher(args)) {
    return voucherCoveredServiceDueCents(args);
  }

  return Math.max(0, Math.round(Number(args.totalPriceCents ?? 0)));
}

export function netPaidServiceCents(payments: PaymentSnapshotLike[] | null | undefined) {
  return (payments ?? [])
    .filter((payment) => !payment.isDeposit)
    .reduce((sum, payment) => {
      const sign = String(payment.direction ?? "IN").toUpperCase() === "OUT" ? -1 : 1;
      return sum + sign * Math.max(0, Math.round(Number(payment.amountCents ?? 0)));
    }, 0);
}

export function netPaidDepositCents(payments: PaymentSnapshotLike[] | null | undefined) {
  return (payments ?? [])
    .filter((payment) => Boolean(payment.isDeposit))
    .reduce((sum, payment) => {
      const sign = String(payment.direction ?? "IN").toUpperCase() === "OUT" ? -1 : 1;
      return sum + sign * Math.max(0, Math.round(Number(payment.amountCents ?? 0)));
    }, 0);
}

export function getCommercialCommitmentBlockers(
  args: CommercialCommitmentArgs
): CommercialCommitmentBlocker[] {
  const blockers: CommercialCommitmentBlocker[] = [];
  const status = String(args.status ?? "").trim().toUpperCase();

  if (args.formalizedAt) blockers.push("FORMALIZED");
  if (["READY_FOR_PLATFORM", "IN_SEA", "COMPLETED", "CANCELED"].includes(status)) {
    blockers.push("OPERATIONAL_STATUS");
  }
  if (isReservationCoveredByPrepaidVoucher(args.snapshot)) blockers.push("PREPAID_VOUCHER");
  if (netPaidServiceCents(args.payments) !== 0 || netPaidDepositCents(args.payments) !== 0) {
    blockers.push("PAYMENT");
  }
  if (
    Number(args.signedContractsCount ?? 0) > 0 ||
    (args.contracts ?? []).some((contract) => String(contract.status ?? "").toUpperCase() === "SIGNED")
  ) {
    blockers.push("SIGNED_CONTRACT");
  }
  if ((args.commissionLines ?? []).some((line) => String(line.status ?? "").toUpperCase() === "PAID")) {
    blockers.push("COMMISSION_PAID");
  }

  return blockers;
}

export function hasCommercialRecalculationCommitment(args: CommercialCommitmentArgs) {
  return getCommercialCommitmentBlockers(args).length > 0;
}

export function hasSufficientCommercialSnapshot(snapshot: CommercialSnapshotLike) {
  const requiredCents = [
    snapshot.basePriceCents,
    snapshot.totalPriceCents,
    snapshot.autoDiscountCents,
    snapshot.manualDiscountCents,
    snapshot.customerDiscountCents,
    snapshot.commissionBaseCents,
    snapshot.appliedCommissionValue,
    snapshot.appliedCommissionCents,
    snapshot.promoterDiscountCents,
    snapshot.companyDiscountCents,
  ];

  if (snapshot.pvpTotalCents != null) requiredCents.push(snapshot.pvpTotalCents);
  if (!requiredCents.every(isFiniteCents)) return false;

  const mode = String(snapshot.appliedCommissionMode ?? "").toUpperCase();
  if (mode !== "PERCENT" && mode !== "FIXED") return false;
  if (!isFiniteNullableNumber(snapshot.appliedCommissionPct)) return false;

  const items = snapshot.items ?? [];
  if (items.length > 0) {
    return items.every(
      (item) => isFiniteCents(item.unitPriceCents) && isFiniteCents(item.totalPriceCents)
    );
  }

  return true;
}

export function shouldPreserveFormalizeCommercialSnapshot(args: {
  snapshot: CommercialSnapshotLike;
  payments?: PaymentSnapshotLike[] | null;
  explicitRecalculate?: boolean;
}) {
  if (isReservationCoveredByPrepaidVoucher(args.snapshot)) return true;
  if (args.explicitRecalculate) return false;
  return hasSufficientCommercialSnapshot(args.snapshot) || netPaidServiceCents(args.payments) > 0;
}

export function normalizeCommercialPricingState(state: CommercialPricingStateLike) {
  const serviceCategory = String(state.serviceCategory ?? "").trim().toUpperCase();
  const rawMode = String(state.jetskiLicenseMode ?? "").trim().toUpperCase();

  if (serviceCategory !== "JETSKI") {
    return {
      isLicense: Boolean(state.isLicense),
      jetskiLicenseMode: "NONE",
      pricingTier: "STANDARD",
    };
  }

  const jetskiLicenseMode =
    rawMode === "GREEN_LIMITED" || rawMode === "YELLOW_UNLIMITED"
      ? rawMode
      : state.isLicense
        ? "YELLOW_UNLIMITED"
        : "NONE";

  return {
    isLicense: jetskiLicenseMode !== "NONE",
    jetskiLicenseMode,
    pricingTier: jetskiLicenseMode === "GREEN_LIMITED" ? "RESIDENT" : "STANDARD",
  };
}

export function commercialPricingStateChanged(args: {
  current: CommercialPricingStateLike;
  requested: CommercialPricingStateLike;
}) {
  const current = normalizeCommercialPricingState(args.current);
  const requested = normalizeCommercialPricingState(args.requested);

  return (
    current.isLicense !== requested.isLicense ||
    current.jetskiLicenseMode !== requested.jetskiLicenseMode ||
    current.pricingTier !== requested.pricingTier
  );
}
