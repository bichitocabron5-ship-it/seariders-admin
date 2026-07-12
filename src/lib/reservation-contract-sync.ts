import { ContractStatus, type Prisma } from "@prisma/client";

import {
  planReservationContractSync,
  type ReservationContractPreparedResourceKind,
  type ReservationContractSyncBlocker,
  type ReservationContractSyncPlanReason,
} from "@/lib/reservation-contract-sync-plan";

type ContractRow = {
  id: string;
  reservationItemId: string | null;
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

export type ReservationContractSyncUnitTarget = ReservationContractSyncTarget & {
  reservationItemId: string | null;
  logicalUnitIndex: number;
  materialChange?: boolean;
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
    args.expectedResourceKind ?? inferResourceKindFromTemplate(templateCode);

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

function normalizeReservationItemId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeStatus(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function isActiveContract(contract: ContractRow) {
  return normalizeStatus(contract.status) !== ContractStatus.VOID && !contract.supersededAt;
}

function isSignedContract(contract: ContractRow) {
  return normalizeStatus(contract.status) === ContractStatus.SIGNED;
}

function contractSlot(contract: ContractRow) {
  return Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
}

function toMillis(value: Date | null | undefined) {
  return value?.getTime() ?? 0;
}

function hasRenderData(contract: ContractRow) {
  return Boolean(
    contract.renderedHtml?.trim() ||
      contract.renderedPdfKey?.trim() ||
      contract.renderedPdfUrl?.trim()
  );
}

function uniqueReasons(reasons: ReservationContractSyncPlanReason[]) {
  return Array.from(new Set(reasons));
}

function targetBlocker(args: {
  code: string;
  message: string;
  contracts: ContractRow[];
  reasons: ReservationContractSyncPlanReason[];
}): ReservationContractSyncBlocker {
  return {
    status: 409,
    code: args.code,
    message: args.message,
    contractIds: args.contracts.map((contract) => contract.id),
    reasons: uniqueReasons(args.reasons),
  };
}

function sortTargetCandidates(left: ContractRow, right: ContractRow) {
  const signedDiff = Number(isSignedContract(right)) - Number(isSignedContract(left));
  if (signedDiff !== 0) return signedDiff;

  const leftReady = normalizeStatus(left.status) === ContractStatus.READY;
  const rightReady = normalizeStatus(right.status) === ContractStatus.READY;
  if (leftReady !== rightReady) return leftReady ? -1 : 1;

  const timeDiff = toMillis(right.createdAt) - toMillis(left.createdAt);
  if (timeDiff !== 0) return timeDiff;
  return Number(right.unitIndex ?? 0) - Number(left.unitIndex ?? 0);
}

function normalizeUnitTargets(targets: readonly ReservationContractSyncUnitTarget[]) {
  return targets
    .map((target) => ({
      ...target,
      reservationItemId: normalizeReservationItemId(target.reservationItemId),
      logicalUnitIndex: Math.max(1, Math.trunc(Number(target.logicalUnitIndex ?? 0))),
      templateCode: normalizeCode(target.templateCode),
      expectedResourceKind:
        target.expectedResourceKind ?? inferResourceKindFromTemplate(normalizeCode(target.templateCode)),
      expectedAssetType: normalizeCode(target.expectedAssetType),
      materialChange: Boolean(target.materialChange),
    }))
    .filter((target) => target.logicalUnitIndex >= 1)
    .sort((left, right) => left.logicalUnitIndex - right.logicalUnitIndex);
}

function evaluateTargetCompatibility(
  contract: ContractRow,
  target: ReturnType<typeof normalizeUnitTargets>[number]
) {
  const reasons: ReservationContractSyncPlanReason[] = [];
  const currentTemplateCode = normalizeCode(contract.templateCode);
  const currentRequiresLicense = inferRequiresLicenseFromTemplate(currentTemplateCode);
  const currentResourceKind = inferResourceKindFromTemplate(currentTemplateCode);

  if (currentTemplateCode && target.templateCode && currentTemplateCode !== target.templateCode) {
    reasons.push("template-incompatible");
  }

  if (currentRequiresLicense !== null && currentRequiresLicense !== target.requiresLicense) {
    reasons.push("license-incompatible");
  }

  if (
    currentResourceKind &&
    target.expectedResourceKind &&
    currentResourceKind !== target.expectedResourceKind
  ) {
    reasons.push("resource-kind-incompatible");
  }

  if (
    target.expectedAssetType &&
    contract.preparedAsset?.type &&
    normalizeCode(contract.preparedAsset.type) !== target.expectedAssetType
  ) {
    reasons.push("prepared-asset-type-incompatible");
  }

  return {
    compatible: !reasons.some(
      (reason) =>
        reason === "template-incompatible" ||
        reason === "license-incompatible" ||
        reason === "resource-kind-incompatible"
    ),
    reasons: uniqueReasons(reasons),
  };
}

function buildTargetReset(
  contract: ContractRow,
  target: ReturnType<typeof normalizeUnitTargets>[number],
  reasonsInput: ReservationContractSyncPlanReason[]
) {
  const reasons = [...reasonsInput];
  let clearPreparedJetski = false;
  let clearPreparedAsset = false;
  let clearLicense = false;

  if (target.expectedResourceKind === "asset" && contract.preparedJetskiId) {
    clearPreparedJetski = true;
    reasons.push("prepared-jetski-incompatible");
  }

  if (target.expectedResourceKind === "jetski" && contract.preparedAssetId) {
    clearPreparedAsset = true;
    reasons.push("prepared-asset-incompatible");
  }

  if (reasons.includes("prepared-asset-type-incompatible") && contract.preparedAssetId) {
    clearPreparedAsset = true;
  }

  if (!target.requiresLicense && hasLicenseData(contract)) {
    clearLicense = true;
    reasons.push("license-no-longer-required");
  }

  if (target.requiresLicense && inferRequiresLicenseFromTemplate(normalizeCode(contract.templateCode)) === false) {
    reasons.push("license-now-required");
  }

  if (target.materialChange) {
    reasons.push("material-change");
  }

  const unique = uniqueReasons(reasons);
  if (unique.length === 0) return null;

  const shouldResetToDraft =
    normalizeStatus(contract.status) === ContractStatus.READY &&
    unique.some(
      (reason) =>
        reason === "material-change" ||
        reason === "template-incompatible" ||
        reason === "license-incompatible" ||
        reason === "resource-kind-incompatible" ||
        reason === "license-now-required" ||
        reason === "prepared-jetski-incompatible" ||
        reason === "prepared-asset-incompatible" ||
        reason === "prepared-asset-type-incompatible"
    );

  return {
    contractId: contract.id,
    clearRender:
      target.materialChange ||
      hasRenderData(contract) ||
      unique.some(
        (reason) =>
          reason === "template-incompatible" ||
          reason === "license-incompatible" ||
          reason === "resource-kind-incompatible" ||
          reason === "prepared-jetski-incompatible" ||
          reason === "prepared-asset-incompatible" ||
          reason === "prepared-asset-type-incompatible"
      ),
    clearLicense,
    clearPreparedJetski,
    clearPreparedAsset,
    nextStatus: shouldResetToDraft ? ("DRAFT" as const) : null,
  };
}

function findTargetCandidates(args: {
  target: ReturnType<typeof normalizeUnitTargets>[number];
  activeContracts: ContractRow[];
  usedIds: Set<string>;
  allowLegacyAdoption: boolean;
}) {
  const { target, activeContracts, usedIds } = args;
  const sameItem = activeContracts.filter(
    (contract) =>
      !usedIds.has(contract.id) &&
      normalizeReservationItemId(contract.reservationItemId) === target.reservationItemId
  );
  const exact = sameItem.filter((contract) => contractSlot(contract) === target.logicalUnitIndex);
  if (exact.length > 0) return exact.sort(sortTargetCandidates);

  if (sameItem.length > 0) return sameItem.sort(sortTargetCandidates);

  if (target.reservationItemId && args.allowLegacyAdoption) {
    return activeContracts
      .filter(
        (contract) =>
          !usedIds.has(contract.id) &&
          !normalizeReservationItemId(contract.reservationItemId) &&
          contractSlot(contract) === target.logicalUnitIndex
      )
      .sort(sortTargetCandidates);
  }

  return [];
}

async function syncReservationContractsForTargetsTx(
  tx: Prisma.TransactionClient,
  args: {
    reservationId: string;
    targets: readonly ReservationContractSyncUnitTarget[];
    blockSignedOnMaterialChange?: boolean;
  },
  contracts: ContractRow[]
) {
  const targets = normalizeUnitTargets(args.targets);
  const targetItemIds = new Set(
    targets
      .map((target) => target.reservationItemId)
      .filter((itemId): itemId is string => Boolean(itemId))
  );
  const allowLegacyAdoption = targetItemIds.size <= 1;
  const activeContracts = contracts.filter((contract) => isActiveContract(contract) && contractSlot(contract) >= 1);
  const usedIds = new Set<string>();
  const keep: Array<{
    contract: ContractRow;
    target: ReturnType<typeof normalizeUnitTargets>[number];
  }> = [];
  const create: Array<ReturnType<typeof normalizeUnitTargets>[number]> = [];
  const voidIds = new Set<string>();
  const reset = new Map<string, ReturnType<typeof buildTargetReset>>();
  const blockers: ReservationContractSyncBlocker[] = [];

  function addVoid(contract: ContractRow) {
    if (isSignedContract(contract) || voidIds.has(contract.id)) return;
    voidIds.add(contract.id);
  }

  function addReset(
    contract: ContractRow,
    target: ReturnType<typeof normalizeUnitTargets>[number],
    reasons: ReservationContractSyncPlanReason[]
  ) {
    if (isSignedContract(contract)) return;
    const next = buildTargetReset(contract, target, reasons);
    if (!next) return;
    const current = reset.get(contract.id);
    if (!current) {
      reset.set(contract.id, next);
      return;
    }
    current.clearRender = current.clearRender || next.clearRender;
    current.clearLicense = current.clearLicense || next.clearLicense;
    current.clearPreparedJetski = current.clearPreparedJetski || next.clearPreparedJetski;
    current.clearPreparedAsset = current.clearPreparedAsset || next.clearPreparedAsset;
    current.nextStatus = current.nextStatus ?? next.nextStatus;
  }

  for (const target of targets) {
    const candidates = findTargetCandidates({
      target,
      activeContracts,
      usedIds,
      allowLegacyAdoption,
    });
    const signed = candidates.find((contract) => isSignedContract(contract));

    if (signed) {
      const compatibility = evaluateTargetCompatibility(signed, target);
      if (!compatibility.compatible) {
        blockers.push(
          targetBlocker({
            code: "SIGNED_CONTRACT_TEMPLATE_INCOMPATIBLE",
            message: "Hay contratos firmados con una plantilla incompatible.",
            contracts: [signed],
            reasons: ["signed-template-incompatible"],
          })
        );
      }
      if (args.blockSignedOnMaterialChange && target.materialChange) {
        blockers.push(
          targetBlocker({
            code: "SIGNED_CONTRACT_MATERIAL_CHANGE",
            message: "Hay contratos firmados activos y el cambio afecta al contenido contractual.",
            contracts: [signed],
            reasons: ["signed-material-change"],
          })
        );
      }

      keep.push({ contract: signed, target });
      usedIds.add(signed.id);
      for (const duplicate of candidates) {
        if (duplicate.id !== signed.id) addVoid(duplicate);
      }
      continue;
    }

    let keptUnsigned: ContractRow | null = null;
    for (const contract of candidates) {
      const compatibility = evaluateTargetCompatibility(contract, target);
      if (!compatibility.compatible) {
        addReset(contract, target, compatibility.reasons);
        addVoid(contract);
        continue;
      }

      if (!keptUnsigned) {
        keptUnsigned = contract;
        keep.push({ contract, target });
        usedIds.add(contract.id);
        addReset(contract, target, compatibility.reasons);
      } else {
        addVoid(contract);
      }
    }

    if (!keptUnsigned) create.push(target);
  }

  for (const contract of activeContracts) {
    if (usedIds.has(contract.id) || voidIds.has(contract.id)) continue;
    if (isSignedContract(contract)) {
      blockers.push(
        targetBlocker({
          code: "SIGNED_CONTRACT_OUT_OF_RANGE",
          message: "No puedes retirar una unidad con contrato firmado activo.",
          contracts: [contract],
          reasons: ["signed-contract-out-of-range"],
        })
      );
      continue;
    }
    addVoid(contract);
  }

  if (blockers.length > 0) {
    throw new ReservationContractSyncBlockedError(blockers);
  }

  const now = new Date();

  for (const item of reset.values()) {
    if (!item) continue;
    const data = buildResetData(item, { keepStatus: !voidIds.has(item.contractId) });
    if (!hasUpdateData(data)) continue;

    await tx.reservationContract.update({
      where: { id: item.contractId },
      data,
      select: { id: true },
    });
  }

  for (const kept of keep) {
    if (isSignedContract(kept.contract)) continue;

    const data: Prisma.ReservationContractUncheckedUpdateInput = {};
    if (contractSlot(kept.contract) !== kept.target.logicalUnitIndex) {
      data.logicalUnitIndex = kept.target.logicalUnitIndex;
    }
    if (
      normalizeReservationItemId(kept.contract.reservationItemId) !== kept.target.reservationItemId
    ) {
      data.reservationItemId = kept.target.reservationItemId;
    }
    if (normalizeCode(kept.contract.templateCode) !== kept.target.templateCode) {
      data.templateCode = kept.target.templateCode;
    }

    if (!hasUpdateData(data)) continue;

    await tx.reservationContract.update({
      where: { id: kept.contract.id },
      data,
      select: { id: true },
    });
  }

  if (voidIds.size > 0) {
    await tx.reservationContract.updateMany({
      where: { id: { in: Array.from(voidIds) } },
      data: {
        status: ContractStatus.VOID,
        supersededAt: now,
        preparedJetskiId: null,
        preparedAssetId: null,
      },
    });
  }

  const maxUnitIndex = Math.max(0, ...contracts.map((contract) => Number(contract.unitIndex ?? 0)));
  if (create.length > 0) {
    await tx.reservationContract.createMany({
      data: create.map((target, index) => ({
        reservationId: args.reservationId,
        reservationItemId: target.reservationItemId,
        unitIndex: maxUnitIndex + index + 1,
        logicalUnitIndex: target.logicalUnitIndex,
        templateCode: target.templateCode,
      })),
      skipDuplicates: true,
    });
  }

  return {
    keptContracts: keep.length,
    createdContracts: create.length,
    voidedContracts: voidIds.size,
    resetContracts: Array.from(reset.values()).filter(Boolean).length,
    requiredUnits: targets.length,
  };
}

export async function syncReservationContractsTx(
  tx: Prisma.TransactionClient,
  args: {
    reservationId: string;
    requiredUnits: number;
    targets?: readonly ReservationContractSyncUnitTarget[];
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
      reservationItemId: true,
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

  if (args.targets) {
    const result = await syncReservationContractsForTargetsTx(
      tx,
      {
        reservationId: args.reservationId,
        targets: args.targets,
        blockSignedOnMaterialChange: args.blockSignedOnMaterialChange,
      },
      contracts
    );

    return {
      ...result,
      plan: {
        requiredUnits: result.requiredUnits,
        desiredTemplateCode: null,
        desiredRequiresLicense: false,
        expectedResourceKind: null,
        keep: [],
        create: [],
        void: [],
        reset: [],
        blockers: [],
      },
    };
  }

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
