import { ContractStatus, type Prisma } from "@prisma/client";

import {
  planReservationContractSync,
  type ReservationContractPreparedResourceKind,
  type ReservationContractSyncBlocker,
} from "@/lib/reservation-contract-sync-plan";

type ContractRow = {
  id: string;
  unitIndex: number | null;
  logicalUnitIndex: number | null;
  status: string | null;
  supersededAt: Date | null;
  createdAt: Date;
  templateCode: string | null;
  renderedHtml: string | null;
  renderedPdfKey: string | null;
  renderedPdfUrl: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  preparedJetskiId: string | null;
  preparedAssetId: string | null;
  preparedAsset: { type: string | null } | null;
};

export type ReservationContractSyncTarget = {
  templateCode: string | null;
  requiresLicense: boolean;
  expectedResourceKind: ReservationContractPreparedResourceKind | null;
  expectedAssetType: string | null;
};

export class ReservationContractSyncBlockedError extends Error {
  public readonly status = 409;
  public readonly code: string;
  public readonly blockers: ReservationContractSyncBlocker[];

  constructor(blockers: ReservationContractSyncBlocker[]) {
    const first = blockers[0];
    super(first?.message ?? "No se pueden sincronizar los contratos de la reserva.");
    this.name = "ReservationContractSyncBlockedError";
    this.code = first?.code ?? "RESERVATION_CONTRACT_SYNC_BLOCKED";
    this.blockers = blockers;
  }
}

function normalizeCode(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function inferTemplateCode(args: {
  serviceCategory?: string | null;
  isLicense: boolean;
}) {
  const category = normalizeCode(args.serviceCategory);

  if (category === "JETSKI" && args.isLicense) return "JETSKI_LICENSED";
  if (category === "JETSKI") return "JETSKI_NO_LICENSE";
  if (category === "BOAT" && args.isLicense) return "BOAT_LICENSED";
  return null;
}

function inferResourceKindFromTemplate(
  templateCode: string | null
): ReservationContractPreparedResourceKind | null {
  if (templateCode === "JETSKI_LICENSED") return "jetski";
  if (templateCode === "BOAT_LICENSED") return "asset";
  return null;
}

function inferRequiresLicenseFromTemplate(templateCode: string | null) {
  if (!templateCode) return null;
  return templateCode.endsWith("_LICENSED");
}

function hasLicenseData(contract: ContractRow) {
  return Boolean(
    contract.licenseSchool?.trim() ||
      contract.licenseType?.trim() ||
      contract.licenseNumber?.trim()
  );
}

function inferRequiresLicenseFromContracts(contracts: ContractRow[]) {
  for (const contract of contracts) {
    if (contract.status === ContractStatus.VOID || contract.supersededAt) continue;
    const inferred = inferRequiresLicenseFromTemplate(normalizeCode(contract.templateCode));
    if (inferred !== null) return inferred;
    if (hasLicenseData(contract)) return true;
  }

  return false;
}

export function resolveReservationContractSyncTarget(args: {
  serviceCategory?: string | null;
  isLicense: boolean;
}): ReservationContractSyncTarget {
  const templateCode = inferTemplateCode(args);
  const expectedResourceKind = inferResourceKindFromTemplate(templateCode);

  return {
    templateCode,
    requiresLicense: Boolean(args.isLicense),
    expectedResourceKind,
    expectedAssetType: templateCode === "BOAT_LICENSED" ? "BOAT" : null,
  };
}

function resolveSyncTarget(
  args: {
    templateCode?: string | null;
    requiresLicense?: boolean;
    expectedResourceKind?: ReservationContractPreparedResourceKind | null;
    expectedAssetType?: string | null;
  },
  contracts: ContractRow[]
): ReservationContractSyncTarget {
  const templateCode = normalizeCode(args.templateCode);
  const inferredRequiresLicense = inferRequiresLicenseFromTemplate(templateCode);
  const expectedResourceKind =
    args.expectedResourceKind !== undefined
      ? args.expectedResourceKind
      : inferResourceKindFromTemplate(templateCode);

  return {
    templateCode,
    requiresLicense:
      typeof args.requiresLicense === "boolean"
        ? args.requiresLicense
        : inferredRequiresLicense ?? inferRequiresLicenseFromContracts(contracts),
    expectedResourceKind: expectedResourceKind ?? null,
    expectedAssetType: normalizeCode(args.expectedAssetType),
  };
}

function buildResetData(
  reset: {
    clearRender: boolean;
    clearLicense: boolean;
    clearPreparedJetski: boolean;
    clearPreparedAsset: boolean;
    nextStatus: "DRAFT" | null;
  },
  args: {
    keepStatus: boolean;
  }
) {
  const data: Prisma.ReservationContractUncheckedUpdateInput = {};

  if (reset.clearRender) {
    data.renderedHtml = null;
    data.renderedPdfKey = null;
    data.renderedPdfUrl = null;
    data.templateVersion = null;
  }

  if (reset.clearLicense) {
    data.licenseSchool = null;
    data.licenseType = null;
    data.licenseNumber = null;
  }

  if (reset.clearPreparedJetski) {
    data.preparedJetskiId = null;
  }

  if (reset.clearPreparedAsset) {
    data.preparedAssetId = null;
  }

  if (reset.nextStatus && args.keepStatus) {
    data.status = ContractStatus.DRAFT;
  }

  return data;
}

function hasUpdateData(data: Prisma.ReservationContractUncheckedUpdateInput) {
  return Object.keys(data).length > 0;
}

export async function syncReservationContractsTx(
  tx: Prisma.TransactionClient,
  args: {
    reservationId: string;
    requiredUnits: number;
    confirmSignedReduction?: boolean;
    templateCode?: string | null;
    requiresLicense?: boolean;
    expectedResourceKind?: ReservationContractPreparedResourceKind | null;
    expectedAssetType?: string | null;
    materialChange?: boolean;
    blockSignedOnMaterialChange?: boolean;
  }
) {
  void args.confirmSignedReduction;

  const requiredUnits = Math.max(0, Number(args.requiredUnits ?? 0));
  const contracts = await tx.reservationContract.findMany({
    where: { reservationId: args.reservationId },
    select: {
      id: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
      templateCode: true,
      renderedHtml: true,
      renderedPdfKey: true,
      renderedPdfUrl: true,
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,
      preparedJetskiId: true,
      preparedAssetId: true,
      preparedAsset: { select: { type: true } },
    },
  });

  const target = resolveSyncTarget(args, contracts);
  const plan = planReservationContractSync({
    requiredUnits,
    contracts: contracts.map((contract) => ({
      id: contract.id,
      unitIndex: contract.unitIndex,
      logicalUnitIndex: contract.logicalUnitIndex,
      status: contract.status,
      supersededAt: contract.supersededAt,
      createdAt: contract.createdAt,
      templateCode: contract.templateCode,
      requiresLicense: inferRequiresLicenseFromTemplate(normalizeCode(contract.templateCode)),
      preparedJetskiId: contract.preparedJetskiId,
      preparedAssetId: contract.preparedAssetId,
      preparedAssetType: contract.preparedAsset?.type ?? null,
      expectedResourceKind: inferResourceKindFromTemplate(normalizeCode(contract.templateCode)),
      renderedHtml: contract.renderedHtml,
      renderedPdfKey: contract.renderedPdfKey,
      renderedPdfUrl: contract.renderedPdfUrl,
      licenseSchool: contract.licenseSchool,
      licenseType: contract.licenseType,
      licenseNumber: contract.licenseNumber,
    })),
    templateCode: target.templateCode,
    requiresLicense: target.requiresLicense,
    expectedResourceKind: target.expectedResourceKind,
    expectedAssetType: target.expectedAssetType,
    materialChange: Boolean(args.materialChange),
    blockSignedOnMaterialChange: Boolean(args.blockSignedOnMaterialChange),
  });

  if (plan.blockers.length > 0) {
    throw new ReservationContractSyncBlockedError(plan.blockers);
  }

  const now = new Date();
  const voidedIds = new Set(plan.void.map((item) => item.contractId));

  for (const reset of plan.reset) {
    const data = buildResetData(reset, { keepStatus: !voidedIds.has(reset.contractId) });
    if (!hasUpdateData(data)) continue;

    await tx.reservationContract.update({
      where: { id: reset.contractId },
      data,
      select: { id: true },
    });
  }

  if (plan.void.length > 0) {
    await tx.reservationContract.updateMany({
      where: { id: { in: plan.void.map((item) => item.contractId) } },
      data: {
        status: ContractStatus.VOID,
        supersededAt: now,
        preparedJetskiId: null,
        preparedAssetId: null,
      },
    });
  }

  const maxUnitIndex = Math.max(0, ...contracts.map((contract) => Number(contract.unitIndex ?? 0)));
  if (plan.create.length > 0) {
    await tx.reservationContract.createMany({
      data: plan.create.map((item, index) => ({
        reservationId: args.reservationId,
        unitIndex: maxUnitIndex + index + 1,
        logicalUnitIndex: item.logicalUnitIndex,
        templateCode: item.templateCode,
      })),
      skipDuplicates: true,
    });
  }

  return {
    keptContracts: plan.keep.length,
    createdContracts: plan.create.length,
    voidedContracts: plan.void.length,
    resetContracts: plan.reset.length,
    plan,
  };
}
