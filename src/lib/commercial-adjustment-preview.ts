import {
  type CommercialAdjustmentOperationType,
  type CommercialAdjustmentRefundMode,
  resolveCommercialAdjustmentPolicy,
} from "./commercial-adjustment-policy";
import { pickVisibleContractsByLogicalUnit } from "./contracts/active-contracts";
import { netPaidDepositCents, netPaidServiceCents } from "./reservation-commercial-snapshot";
import { computeRequiredContractUnits } from "./reservation-rules";

type PaymentLike = {
  amountCents?: number | null;
  isDeposit?: boolean | null;
  direction?: string | null;
};

type ContractLike = {
  unitIndex: number | null;
  logicalUnitIndex?: number | null;
  status?: string | null;
  supersededAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type ReservationItemLike = {
  quantity: number | null;
  isExtra: boolean;
  totalPriceCents?: number | null;
  service: { category: string | null } | null;
};

export type CommercialAdjustmentPreviewReservation = {
  id: string;
  status?: string | null;
  totalPriceCents?: number | null;
  depositCents?: number | null;
  giftVoucherId?: string | null;
  passVoucherId?: string | null;
  passConsumeId?: string | null;
  quantity?: number | null;
  isLicense?: boolean | null;
  service?: { category?: string | null } | null;
  items?: ReservationItemLike[] | null;
  payments?: PaymentLike[] | null;
  contracts?: ContractLike[] | null;
  commissionLines?: Array<{ status?: string | null }> | null;
};

export type CommercialAdjustmentPreviewProposal = {
  newTotalCents: number | null | undefined;
  newDepositCents?: number | null;
  operationType: CommercialAdjustmentOperationType;
  requestedRefundMode?: CommercialAdjustmentRefundMode | "none" | null;
  reason?: string | null;
};

export type CommercialAdjustmentPreviewResult = {
  canCommit: boolean;
  blockers: ReturnType<typeof resolveCommercialAdjustmentPolicy>["blockers"];
  warnings: ReturnType<typeof resolveCommercialAdjustmentPolicy>["warnings"];
  oldTotalCents: number;
  newTotalCents: number;
  paidServiceCents: number;
  paidDepositCents: number;
  pendingServiceCents: number;
  overpaidServiceCents: number;
  refundNowCents: number;
  pendingRefundCents: number;
  requiredActions: ReturnType<typeof resolveCommercialAdjustmentPolicy>["requiredActions"];
};

export const commercialAdjustmentPreviewReservationSelect = {
  id: true,
  status: true,
  totalPriceCents: true,
  depositCents: true,
  giftVoucherId: true,
  passVoucherId: true,
  passConsumeId: true,
  quantity: true,
  isLicense: true,
  service: { select: { category: true } },
  items: {
    select: {
      quantity: true,
      isExtra: true,
      totalPriceCents: true,
      service: { select: { category: true } },
    },
  },
  payments: {
    select: {
      amountCents: true,
      isDeposit: true,
      direction: true,
    },
  },
  contracts: {
    orderBy: { unitIndex: "asc" },
    select: {
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
    },
  },
  commissionLines: {
    select: {
      status: true,
    },
  },
} as const;

export type CommercialAdjustmentPreviewClient = {
  reservation: {
    findUnique(args: unknown): Promise<CommercialAdjustmentPreviewReservation | null>;
  };
};

function normalizeCents(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function normalizeRequestedRefundMode(
  value: CommercialAdjustmentPreviewProposal["requestedRefundMode"]
): CommercialAdjustmentRefundMode | null {
  if (value === "refundNow" || value === "leavePendingRefund") return value;
  return null;
}

function hasStatus(lines: Array<{ status?: string | null }> | null | undefined, status: string) {
  const expected = status.trim().toUpperCase();
  return (lines ?? []).some((line) => String(line.status ?? "").trim().toUpperCase() === expected);
}

export function buildCommercialAdjustmentPreview(
  reservation: CommercialAdjustmentPreviewReservation,
  proposal: CommercialAdjustmentPreviewProposal
): CommercialAdjustmentPreviewResult {
  const oldTotalCents = normalizeCents(reservation.totalPriceCents);
  const newTotalCents = normalizeCents(proposal.newTotalCents);
  const paidServiceCents = Math.max(0, normalizeCents(netPaidServiceCents(reservation.payments)));
  const paidDepositCents = Math.max(0, normalizeCents(netPaidDepositCents(reservation.payments)));
  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: reservation.items ?? [],
  });
  const visibleContracts = pickVisibleContractsByLogicalUnit(reservation.contracts ?? [], requiredUnits);
  const hasSignedContracts =
    (reservation.contracts ?? []).some(
      (contract) =>
        String(contract.status ?? "").toUpperCase() === "SIGNED" && !contract.supersededAt
    ) ||
    visibleContracts.some((contract) => String(contract.status ?? "").toUpperCase() === "SIGNED");

  const policy = resolveCommercialAdjustmentPolicy({
    oldTotalCents,
    newTotalCents,
    paidServiceCents,
    paidDepositCents,
    hasSignedContracts,
    reservationStatus: reservation.status,
    hasPaidCommission: hasStatus(reservation.commissionLines, "PAID"),
    hasPendingCommission: hasStatus(reservation.commissionLines, "PENDING"),
    hasVoucherOrPassOrGift: Boolean(
      reservation.giftVoucherId || reservation.passVoucherId || reservation.passConsumeId
    ),
    requestedRefundMode: normalizeRequestedRefundMode(proposal.requestedRefundMode),
    reason: proposal.reason,
    operationType: proposal.operationType,
  });

  return {
    canCommit: policy.canCommit,
    blockers: policy.blockers,
    warnings: policy.warnings,
    oldTotalCents,
    newTotalCents,
    paidServiceCents,
    paidDepositCents,
    pendingServiceCents: policy.pendingServiceCents,
    overpaidServiceCents: policy.overpaidServiceCents,
    refundNowCents: policy.refundNowCents,
    pendingRefundCents: policy.pendingRefundCents,
    requiredActions: policy.requiredActions,
  };
}

export async function readCommercialAdjustmentPreview(
  client: CommercialAdjustmentPreviewClient,
  reservationId: string,
  proposal: CommercialAdjustmentPreviewProposal
) {
  const reservation = await client.reservation.findUnique({
    where: { id: reservationId },
    select: commercialAdjustmentPreviewReservationSelect,
  });

  if (!reservation) return null;
  return buildCommercialAdjustmentPreview(reservation, proposal);
}
