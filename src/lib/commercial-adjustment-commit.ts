import {
  ContractStatus,
  PaymentDirection,
  PaymentMethod,
  PaymentOrigin,
  ReservationStatus,
  ReservationUnitStatus,
  type Prisma,
} from "@prisma/client";

import {
  type CommercialAdjustmentOperationType,
  type CommercialAdjustmentRefundMode,
  type CommercialAdjustmentRefundScope,
  resolveCommercialAdjustmentPolicy,
} from "./commercial-adjustment-policy";
import { syncChannelCommissionLineFromReservationTx } from "./channel-commission-lines";
import { getAppliedCommercialSnapshotTx } from "./commission";
import { pickVisibleContractsByTargets } from "./contracts/active-contracts";
import { netPaidDepositCents, netPaidServiceCents } from "./reservation-commercial-snapshot";
import {
  syncReservationContractsTx,
} from "./reservation-contract-sync";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "./reservation-contract-requirements";

type PaymentLike = {
  id?: string | null;
  amountCents?: number | null;
  isDeposit?: boolean | null;
  direction?: string | null;
};

type ContractLike = {
  id: string;
  reservationItemId?: string | null;
  unitIndex: number | null;
  logicalUnitIndex?: number | null;
  status?: string | null;
  supersededAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type ReservationItemLike = {
  id: string;
  serviceId?: string | null;
  optionId?: string | null;
  quantity: number | null;
  pax?: number | null;
  isExtra: boolean;
  totalPriceCents?: number | null;
  service: { name?: string | null; category: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

type CommitReservation = {
  id: string;
  source?: string | null;
  status?: string | null;
  customerName?: string | null;
  totalPriceCents?: number | null;
  depositCents?: number | null;
  depositHeld?: boolean | null;
  depositHoldReason?: string | null;
  giftVoucherId?: string | null;
  passVoucherId?: string | null;
  passConsumeId?: string | null;
  serviceId?: string | null;
  optionId?: string | null;
  channelId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  isLicense?: boolean | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  items?: ReservationItemLike[] | null;
  payments?: PaymentLike[] | null;
  contracts?: ContractLike[] | null;
  commissionLines?: Array<{ status?: string | null }> | null;
};

export type CommercialAdjustmentCommitProposal = {
  newTotalCents: number | null | undefined;
  newDepositCents?: number | null;
  operationType: CommercialAdjustmentOperationType;
  requestedRefundMode?: CommercialAdjustmentRefundMode | "none" | null;
  refundScope?: CommercialAdjustmentRefundScope | null;
  reason?: string | null;
};

export type CommercialAdjustmentCommitSummary = {
  ok: true;
  id: string;
  operationType: CommercialAdjustmentOperationType;
  status: string;
  oldTotalCents: number;
  newTotalCents: number;
  oldDepositCents: number;
  newDepositCents: number;
  paidServiceCents: number;
  paidDepositCents: number;
  pendingServiceCents: number;
  pendingDepositCents: number;
  overpaidServiceCents: number;
  overpaidDepositCents: number;
  refundableServiceCents: number;
  refundableDepositCents: number;
  serviceRefundNowCents: number;
  depositRefundNowCents: number;
  pendingServiceRefundCents: number;
  pendingDepositRefundCents: number;
  depositRefundHeldCents: number;
  depositRefundBlockedReason: "DEPOSIT_HELD" | null;
  pendingRefundCents: number;
  refundNowCents: number;
  blockers: ReturnType<typeof resolveCommercialAdjustmentPolicy>["blockers"];
  warnings: ReturnType<typeof resolveCommercialAdjustmentPolicy>["warnings"];
  requiredActions: ReturnType<typeof resolveCommercialAdjustmentPolicy>["requiredActions"];
  contracts: {
    requiredUnits: number;
    keptContracts: number;
    createdContracts: number;
    voidedContracts: number;
    resetContracts: number;
  };
};

export type CommercialAdjustmentCommitClient = {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

export type CommercialAdjustmentCommitOptions = {
  actorUserId?: string | null;
  refundMethod?: PaymentMethod | null;
  refundOrigin?: PaymentOrigin | null;
  refundShiftSessionId?: string | null;
  assertRefundCashOpen?: () => Promise<void>;
  beforeMutationTx?: (
    tx: Prisma.TransactionClient,
    context: {
      reservation: CommitReservation;
      proposal: CommercialAdjustmentCommitProposal;
      evaluation: ReturnType<typeof buildCommercialAdjustmentCommitEvaluation>;
    }
  ) => Promise<void>;
  afterMutationTx?: (
    tx: Prisma.TransactionClient,
    context: {
      reservation: CommitReservation;
      proposal: CommercialAdjustmentCommitProposal;
      evaluation: ReturnType<typeof buildCommercialAdjustmentCommitEvaluation>;
      resultEvaluation: ReturnType<typeof buildPostCommitEvaluation>;
      updated: { id: string; status: ReservationStatus };
      now: Date;
    }
  ) => Promise<void>;
  phase?: "B3A" | "B3B" | null;
};

export class CommercialAdjustmentCommitBlockedError extends Error {
  public readonly status = 409;
  public readonly blockers: ReturnType<typeof resolveCommercialAdjustmentPolicy>["blockers"];
  public readonly summary: Omit<CommercialAdjustmentCommitSummary, "ok" | "id" | "status" | "contracts">;

  constructor(args: {
    message: string;
    blockers: ReturnType<typeof resolveCommercialAdjustmentPolicy>["blockers"];
    summary: Omit<CommercialAdjustmentCommitSummary, "ok" | "id" | "status" | "contracts">;
  }) {
    super(args.message);
    this.name = "CommercialAdjustmentCommitBlockedError";
    this.blockers = args.blockers;
    this.summary = args.summary;
  }
}

export const commercialAdjustmentCommitReservationSelect = {
  id: true,
  source: true,
  status: true,
  customerName: true,
  totalPriceCents: true,
  depositCents: true,
  depositHeld: true,
  depositHoldReason: true,
  giftVoucherId: true,
  passVoucherId: true,
  passConsumeId: true,
  serviceId: true,
  optionId: true,
  channelId: true,
  quantity: true,
  pax: true,
  isLicense: true,
  service: { select: { name: true, category: true } },
  option: { select: { durationMinutes: true } },
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      serviceId: true,
      optionId: true,
      quantity: true,
      pax: true,
      isExtra: true,
      totalPriceCents: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
    },
  },
  payments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amountCents: true,
      isDeposit: true,
      direction: true,
    },
  },
  contracts: {
    orderBy: { unitIndex: "asc" },
    select: {
      id: true,
      reservationItemId: true,
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

function normalizeCents(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function normalizeRequestedRefundMode(
  value: CommercialAdjustmentCommitProposal["requestedRefundMode"]
): CommercialAdjustmentRefundMode | null {
  if (value === "refundNow" || value === "leavePendingRefund") return value;
  return null;
}

function normalizeRefundScope(
  value: CommercialAdjustmentCommitProposal["refundScope"]
): CommercialAdjustmentRefundScope {
  if (value === "SERVICE" || value === "DEPOSIT" || value === "FULL" || value === "NONE") {
    return value;
  }
  return "FULL";
}

function refundScopeIncludesService(scope: CommercialAdjustmentRefundScope) {
  return scope === "SERVICE" || scope === "FULL";
}

function refundScopeIncludesDeposit(scope: CommercialAdjustmentRefundScope) {
  return scope === "DEPOSIT" || scope === "FULL";
}

function normalizeReason(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text.slice(0, 500) : null;
}

function hasStatus(lines: Array<{ status?: string | null }> | null | undefined, status: string) {
  const expected = status.trim().toUpperCase();
  return (lines ?? []).some((line) => String(line.status ?? "").trim().toUpperCase() === expected);
}

function isActiveSignedContract(contract: ContractLike) {
  return (
    String(contract.status ?? "").trim().toUpperCase() === "SIGNED" &&
    !contract.supersededAt
  );
}

function blockerMessage(blockers: ReturnType<typeof resolveCommercialAdjustmentPolicy>["blockers"]) {
  if (blockers.includes("REFUND_NOW_NOT_SUPPORTED_B3A")) {
    return "refundNow se implementa en B3B";
  }
  if (blockers.includes("CANCEL_REASON_REQUIRED")) {
    return "La cancelacion requiere motivo.";
  }
  if (blockers.includes("SIGNED_CONTRACT_MATERIAL_EDIT")) {
    return "La reserva tiene contratos firmados y no permite un ajuste comercial EDIT.";
  }
  if (blockers.includes("PAID_COMMISSION")) {
    return "La reserva tiene una comision pagada.";
  }
  if (blockers.includes("ADVANCED_RESERVATION_STATUS")) {
    return "El estado de la reserva no permite este ajuste comercial.";
  }
  if (blockers.includes("VOUCHER_OR_PASS_OR_GIFT")) {
    return "Voucher/pass/gift se bloquea en fase 1.";
  }
  if (blockers.includes("REFUND_MODE_REQUIRED")) {
    return "La reserva queda sobrepagada y requiere leavePendingRefund en B3A.";
  }
  if (blockers.includes("REFUND_SCOPE_INCOMPATIBLE")) {
    return "El ajuste deja servicio sobrepagado y el alcance de devolucion debe incluir SERVICE.";
  }
  if (blockers.includes("REFUND_REASON_REQUIRED")) {
    return "La devolucion requiere motivo.";
  }
  return "No se puede aplicar el ajuste comercial.";
}

function buildRefundDescription(operationType: CommercialAdjustmentOperationType) {
  return operationType === "CANCEL"
    ? "Devolucion por cancelacion comercial"
    : "Devolucion por ajuste comercial";
}

function buildRefundNotes(args: {
  reason: string;
  operationType: CommercialAdjustmentOperationType;
  refundKind: "SERVICE" | "DEPOSIT";
  oldTotalCents: number;
  newTotalCents: number;
  refundNowCents: number;
}) {
  return [
    `Motivo: ${args.reason}`,
    `Operacion: ${args.operationType}`,
    `Tipo: ${args.refundKind}`,
    `Total anterior: ${args.oldTotalCents}`,
    `Total nuevo: ${args.newTotalCents}`,
    `Devolucion: ${args.refundNowCents}`,
  ].join(" | ").slice(0, 800);
}

function buildPostCommitEvaluation(
  evaluation: ReturnType<typeof buildCommercialAdjustmentCommitEvaluation>
) {
  if (evaluation.refundNowCents <= 0) return evaluation;

  const paidServiceCents = Math.max(0, evaluation.paidServiceCents - evaluation.serviceRefundNowCents);
  const paidDepositCents = Math.max(0, evaluation.paidDepositCents - evaluation.depositRefundNowCents);
  return {
    ...evaluation,
    paidServiceCents,
    paidDepositCents,
    pendingServiceCents: Math.max(0, evaluation.newTotalCents - paidServiceCents),
    pendingDepositCents: Math.max(0, evaluation.newDepositCents - paidDepositCents),
    overpaidServiceCents: Math.max(0, paidServiceCents - evaluation.newTotalCents),
    overpaidDepositCents: Math.max(0, paidDepositCents - evaluation.newDepositCents),
    pendingRefundCents: 0,
  };
}

function allocateAmounts(lines: Array<{ id: string; amountCents: number }>, targetGrossCents: number) {
  const target = normalizeCents(targetGrossCents);
  if (lines.length === 0) return [] as Array<{ id: string; amountCents: number }>;
  if (target === 0) return lines.map((line) => ({ id: line.id, amountCents: 0 }));

  const currentGross = lines.reduce((sum, line) => sum + normalizeCents(line.amountCents), 0);
  if (currentGross <= 0) {
    return lines.map((line, index) => ({
      id: line.id,
      amountCents: index === 0 ? target : 0,
    }));
  }

  const scaled = lines.map((line) => {
    const raw = (normalizeCents(line.amountCents) * target) / currentGross;
    const base = Math.floor(raw);
    return {
      id: line.id,
      amountCents: base,
      remainder: raw - base,
    };
  });

  let remainder = target - scaled.reduce((sum, line) => sum + line.amountCents, 0);
  scaled
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((line) => {
      if (remainder <= 0) return;
      const match = scaled.find((entry) => entry.id === line.id);
      if (!match) return;
      match.amountCents += 1;
      remainder -= 1;
    });

  return scaled.map(({ id, amountCents }) => ({ id, amountCents }));
}

function allocateReservationItemTotals(items: ReservationItemLike[], targetGrossCents: number) {
  const allocated = allocateAmounts(
    items.map((item) => ({ id: item.id, amountCents: normalizeCents(item.totalPriceCents) })),
    targetGrossCents
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  return allocated.map((entry) => {
    const current = byId.get(entry.id);
    const quantity = Math.max(1, Number(current?.quantity ?? 1));
    return {
      id: entry.id,
      totalPriceCents: entry.amountCents,
      unitPriceCents: Math.round(entry.amountCents / quantity),
      isExtra: Boolean(current?.isExtra),
    };
  });
}

function buildCommercialAdjustmentCommitEvaluation(
  reservation: CommitReservation,
  proposal: CommercialAdjustmentCommitProposal,
  phase: "B3A" | "B3B" | null = "B3B"
) {
  const oldTotalCents = normalizeCents(reservation.totalPriceCents);
  const newTotalCents = normalizeCents(proposal.newTotalCents);
  const oldDepositCents = normalizeCents(reservation.depositCents);
  const newDepositCents = normalizeCents(proposal.newDepositCents ?? reservation.depositCents);
  const paidServiceCents = Math.max(0, normalizeCents(netPaidServiceCents(reservation.payments)));
  const paidDepositCents = Math.max(0, normalizeCents(netPaidDepositCents(reservation.payments)));
  const requestedRefundMode = normalizeRequestedRefundMode(proposal.requestedRefundMode);
  const refundScope = normalizeRefundScope(proposal.refundScope);
  const refundService = refundScopeIncludesService(refundScope);
  const refundDeposit = refundScopeIncludesDeposit(refundScope);
  const refundableServiceCents = Math.max(0, paidServiceCents - newTotalCents);
  const refundableDepositCents =
    proposal.operationType === "CANCEL" ? Math.max(0, paidDepositCents - newDepositCents) : 0;
  const depositRefundBlockedReason =
    refundDeposit && refundableDepositCents > 0 && reservation.depositHeld
      ? ("DEPOSIT_HELD" as const)
      : null;
  const serviceRefundNowCents =
    requestedRefundMode === "refundNow" && refundService ? refundableServiceCents : 0;
  const depositRefundNowCents =
    requestedRefundMode === "refundNow" && refundDeposit && !depositRefundBlockedReason
      ? refundableDepositCents
      : 0;
  const pendingServiceRefundCents =
    requestedRefundMode === "leavePendingRefund" && refundService ? refundableServiceCents : 0;
  const pendingDepositRefundCents =
    requestedRefundMode === "leavePendingRefund" && refundDeposit && !depositRefundBlockedReason
      ? refundableDepositCents
      : 0;
  const depositRefundHeldCents = refundDeposit && depositRefundBlockedReason ? refundableDepositCents : 0;
  const contractRequirements = buildReservationContractRequirements({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    serviceId: reservation.serviceId,
    optionId: reservation.optionId,
    serviceName: reservation.service?.name ?? null,
    durationMinutes: reservation.option?.durationMinutes ?? null,
    pax: reservation.pax,
    totalPriceCents: reservation.totalPriceCents,
    items: reservation.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const visibleContracts = pickVisibleContractsByTargets(reservation.contracts ?? [], syncTargets);
  const hasSignedContracts =
    (reservation.contracts ?? []).some(isActiveSignedContract) ||
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
    requestedRefundMode,
    refundScope,
    reason: proposal.reason,
    operationType: proposal.operationType,
    phase,
  });
  const blockers = [...policy.blockers];
  const warnings = [...policy.warnings];
  const requiredActions = [...policy.requiredActions];

  if (
    proposal.operationType === "CANCEL" &&
    refundableDepositCents > 0 &&
    refundDeposit &&
    !depositRefundBlockedReason &&
    requestedRefundMode !== "refundNow" &&
    requestedRefundMode !== "leavePendingRefund" &&
    !blockers.includes("REFUND_MODE_REQUIRED")
  ) {
    blockers.push("REFUND_MODE_REQUIRED");
  }

  if (depositRefundBlockedReason) {
    warnings.push("DEPOSIT_HELD_NOT_REFUNDED");
  }

  if (depositRefundNowCents > 0 && !requiredActions.includes("REFUND_NOW")) {
    requiredActions.push("REFUND_NOW");
  }

  if (pendingDepositRefundCents > 0 && !requiredActions.includes("LEAVE_PENDING_REFUND")) {
    requiredActions.push("LEAVE_PENDING_REFUND");
  }

  return {
    operationType: proposal.operationType,
    oldTotalCents,
    newTotalCents,
    oldDepositCents,
    newDepositCents,
    paidServiceCents,
    paidDepositCents,
    pendingServiceCents: policy.pendingServiceCents,
    pendingDepositCents: Math.max(0, newDepositCents - paidDepositCents),
    overpaidServiceCents: policy.overpaidServiceCents,
    overpaidDepositCents: refundableDepositCents,
    refundableServiceCents,
    refundableDepositCents,
    serviceRefundNowCents,
    depositRefundNowCents,
    pendingServiceRefundCents,
    pendingDepositRefundCents,
    depositRefundHeldCents,
    depositRefundBlockedReason,
    refundNowCents: serviceRefundNowCents + depositRefundNowCents,
    pendingRefundCents: pendingServiceRefundCents + pendingDepositRefundCents,
    blockers,
    warnings,
    requiredActions,
  };
}

async function voidUnsignedContractsForCancelTx(
  tx: Prisma.TransactionClient,
  reservationId: string,
  now: Date
) {
  const contracts = await tx.reservationContract.findMany({
    where: { reservationId },
    select: {
      id: true,
      status: true,
      supersededAt: true,
    },
  });

  const unsignedActiveIds = contracts
    .filter(
      (contract) =>
        String(contract.status ?? "").toUpperCase() !== "SIGNED" &&
        String(contract.status ?? "").toUpperCase() !== "VOID" &&
        !contract.supersededAt
    )
    .map((contract) => contract.id);

  if (unsignedActiveIds.length > 0) {
    await tx.reservationContract.updateMany({
      where: { id: { in: unsignedActiveIds } },
      data: {
        status: ContractStatus.VOID,
        supersededAt: now,
        preparedJetskiId: null,
        preparedAssetId: null,
      },
    });
  }

  return {
    requiredUnits: 0,
    keptContracts: contracts.filter((contract) => String(contract.status ?? "").toUpperCase() === "SIGNED").length,
    createdContracts: 0,
    voidedContracts: unsignedActiveIds.length,
    resetContracts: 0,
  };
}

export async function commitCommercialAdjustment(
  client: CommercialAdjustmentCommitClient,
  reservationId: string,
  proposal: CommercialAdjustmentCommitProposal,
  options: CommercialAdjustmentCommitOptions = {}
) {
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Reservation" WHERE "id" = ${reservationId} FOR UPDATE`;

    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: commercialAdjustmentCommitReservationSelect,
    });

    if (!reservation) return null;

    const evaluation = buildCommercialAdjustmentCommitEvaluation(
      reservation,
      proposal,
      options.phase ?? "B3B"
    );
    if (evaluation.blockers.length > 0) {
      throw new CommercialAdjustmentCommitBlockedError({
        message: blockerMessage(evaluation.blockers),
        blockers: evaluation.blockers,
        summary: evaluation,
      });
    }

    await options.beforeMutationTx?.(tx, {
      reservation,
      proposal,
      evaluation,
    });

    const reason = normalizeReason(proposal.reason);
    if (evaluation.refundNowCents > 0) {
      if (!reason) {
        throw new CommercialAdjustmentCommitBlockedError({
          message: blockerMessage(["REFUND_REASON_REQUIRED"]),
          blockers: ["REFUND_REASON_REQUIRED"],
          summary: evaluation,
        });
      }
      if (!options.assertRefundCashOpen) {
        throw new Error("Caja abierta requerida para refundNow");
      }
      await options.assertRefundCashOpen?.();
    }

    const now = new Date();
    const adjustedItems = allocateReservationItemTotals(
      (reservation.items ?? []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        isExtra: Boolean(item.isExtra),
        totalPriceCents: item.totalPriceCents,
        service: item.service,
      })),
      evaluation.newTotalCents
    );
    const adjustedBasePriceCents =
      adjustedItems.length > 0
        ? adjustedItems
            .filter((item) => !item.isExtra)
            .reduce((sum, item) => sum + item.totalPriceCents, 0)
        : evaluation.newTotalCents;
    const totalQuantity = Math.max(1, Number(reservation.quantity ?? 1));
    const commercialSnapshot = await getAppliedCommercialSnapshotTx(tx, {
      channelId: reservation.channelId ?? null,
      serviceId: reservation.serviceId ?? null,
      commissionBaseCents: evaluation.newTotalCents,
      finalTotalCents: evaluation.newTotalCents,
      customerDiscountBaseCents: evaluation.newTotalCents,
      quantity: totalQuantity,
    });

    const shouldCancel = proposal.operationType === "CANCEL";
    const shouldWaitForPayment =
      !shouldCancel && evaluation.pendingServiceCents + evaluation.pendingDepositCents > 0;
    const status = shouldCancel
      ? ReservationStatus.CANCELED
      : shouldWaitForPayment
        ? ReservationStatus.WAITING
        : undefined;

    const data: Prisma.ReservationUncheckedUpdateInput = {
      basePriceCents: adjustedBasePriceCents,
      commissionBaseCents: evaluation.newTotalCents,
      appliedCommissionPct: commercialSnapshot.appliedCommissionPct,
      appliedCommissionMode: commercialSnapshot.appliedCommissionMode,
      appliedCommissionValue: commercialSnapshot.appliedCommissionValue,
      appliedCommissionCents: commercialSnapshot.appliedCommissionCents,
      customerDiscountMode: "PERCENT",
      customerDiscountValue: 0,
      customerDiscountCents: 0,
      autoDiscountCents: 0,
      manualDiscountCents: 0,
      promoterDiscountCents: 0,
      companyDiscountCents: 0,
      promoCode: null,
      totalPriceCents: evaluation.newTotalCents,
      depositCents: evaluation.newDepositCents,
    };

    if (status) data.status = status;
    if (shouldWaitForPayment) {
      data.paymentCompletedAt = null;
      data.readyForPlatformAt = null;
    }
    if (shouldCancel) {
      data.readyForPlatformAt = null;
      data.taxiboatTripId = null;
      data.taxiboatAssignedAt = null;
    }
    if (reason) {
      data.financialAdjustmentNote = reason;
      data.financialAdjustedByUserId = options.actorUserId ?? null;
      data.financialAdjustedAt = now;
    }

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data,
      select: { id: true, status: true },
    });

    for (const item of adjustedItems) {
      await tx.reservationItem.update({
        where: { id: item.id },
        data: {
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
        },
      });
    }

    if (shouldWaitForPayment) {
      await tx.reservationUnit.updateMany({
        where: { reservationId, status: ReservationUnitStatus.READY_FOR_PLATFORM },
        data: {
          status: ReservationUnitStatus.WAITING,
          readyForPlatformAt: null,
        },
      });
    }

    if (shouldCancel) {
      await tx.reservationUnit.updateMany({
        where: { reservationId },
        data: {
          status: ReservationUnitStatus.CANCELED,
          jetskiId: null,
          readyForPlatformAt: null,
        },
      });
    }

    if (evaluation.refundNowCents > 0 && reason) {
      const refundLines = [
        {
          amountCents: evaluation.serviceRefundNowCents,
          isDeposit: false,
          refundKind: "SERVICE" as const,
        },
        {
          amountCents: evaluation.depositRefundNowCents,
          isDeposit: true,
          refundKind: "DEPOSIT" as const,
        },
      ].filter((line) => line.amountCents > 0);

      for (const line of refundLines) {
        await tx.payment.create({
          data: {
            reservationId,
            origin: options.refundOrigin ?? PaymentOrigin.STORE,
            method: options.refundMethod ?? PaymentMethod.CASH,
            amountCents: line.amountCents,
            isDeposit: line.isDeposit,
            direction: PaymentDirection.OUT,
            customerName: reservation.customerName ?? null,
            createdByUserId: options.actorUserId ?? null,
            shiftSessionId: options.refundShiftSessionId ?? null,
            description: buildRefundDescription(proposal.operationType),
            notes: buildRefundNotes({
              reason,
              operationType: proposal.operationType,
              refundKind: line.refundKind,
              oldTotalCents: evaluation.oldTotalCents,
              newTotalCents: evaluation.newTotalCents,
              refundNowCents: line.amountCents,
            }),
          },
        });
      }
    }

    const contractRequirementsForSync = buildReservationContractRequirements({
      quantity: reservation.quantity ?? 0,
      isLicense: Boolean(reservation.isLicense),
      serviceCategory: reservation.service?.category ?? null,
      serviceId: reservation.serviceId,
      optionId: reservation.optionId,
      serviceName: reservation.service?.name ?? null,
      durationMinutes: reservation.option?.durationMinutes ?? null,
      pax: reservation.pax,
      totalPriceCents: reservation.totalPriceCents,
      items: reservation.items ?? [],
    });

    const contracts = shouldCancel
      ? await voidUnsignedContractsForCancelTx(tx, reservationId, now)
      : await syncReservationContractsTx(tx, {
          reservationId,
          requiredUnits: contractRequirementsForSync.length,
          targets: reservationContractRequirementsToSyncTargets(contractRequirementsForSync, {
            materialChange: evaluation.oldTotalCents !== evaluation.newTotalCents,
          }),
          materialChange: evaluation.oldTotalCents !== evaluation.newTotalCents,
        });

    await syncChannelCommissionLineFromReservationTx(tx, reservationId);
    const resultEvaluation = buildPostCommitEvaluation(evaluation);

    await options.afterMutationTx?.(tx, {
      reservation,
      proposal,
      evaluation,
      resultEvaluation,
      updated,
      now,
    });

    return {
      ok: true as const,
      id: updated.id,
      status: updated.status,
      ...resultEvaluation,
      contracts: {
        requiredUnits: "requiredUnits" in contracts ? contracts.requiredUnits : contracts.plan.requiredUnits,
        keptContracts: contracts.keptContracts,
        createdContracts: contracts.createdContracts,
        voidedContracts: contracts.voidedContracts,
        resetContracts: contracts.resetContracts,
      },
    } satisfies CommercialAdjustmentCommitSummary;
  });
}
