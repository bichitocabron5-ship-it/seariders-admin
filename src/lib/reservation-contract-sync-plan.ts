export type ReservationContractSyncStatus = "DRAFT" | "READY" | "SIGNED" | "VOID";

export type ReservationContractPreparedResourceKind = "jetski" | "asset";

export type ReservationContractSyncPlanReason =
  | "active-signed-contracts-exceed-required-units"
  | "signed-contract-out-of-range"
  | "signed-template-incompatible"
  | "signed-license-incompatible"
  | "signed-resource-incompatible"
  | "signed-material-change"
  | "surplus-contract"
  | "duplicate-contract"
  | "template-incompatible"
  | "license-incompatible"
  | "resource-kind-incompatible"
  | "material-change"
  | "license-no-longer-required"
  | "license-now-required"
  | "prepared-jetski-incompatible"
  | "prepared-asset-incompatible"
  | "prepared-asset-type-incompatible"
  | "ready-reset-to-draft";

export type ReservationContractSyncInputContract = {
  id: string;
  unitIndex?: number | null;
  logicalUnitIndex?: number | null;
  status?: ReservationContractSyncStatus | string | null;
  supersededAt?: Date | string | null;
  createdAt?: Date | string | null;
  templateCode?: string | null;
  requiresLicense?: boolean | null;
  preparedJetskiId?: string | null;
  preparedAssetId?: string | null;
  preparedAssetType?: string | null;
  expectedResourceKind?: ReservationContractPreparedResourceKind | null;
  renderedHtml?: string | null;
  renderedPdfKey?: string | null;
  renderedPdfUrl?: string | null;
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
};

export type PlanReservationContractSyncArgs = {
  requiredUnits: number;
  contracts: readonly ReservationContractSyncInputContract[];
  templateCode: string | null;
  requiresLicense: boolean;
  expectedResourceKind?: ReservationContractPreparedResourceKind | null;
  expectedAssetType?: string | null;
  materialChange?: boolean;
  blockSignedOnMaterialChange?: boolean;
};

export type ReservationContractSyncKeep = {
  contractId: string;
  logicalUnitIndex: number;
  status: string | null;
};

export type ReservationContractSyncCreate = {
  logicalUnitIndex: number;
  templateCode: string | null;
  requiresLicense: boolean;
  expectedResourceKind: ReservationContractPreparedResourceKind | null;
};

export type ReservationContractSyncVoid = {
  contractId: string;
  logicalUnitIndex: number;
  reasons: ReservationContractSyncPlanReason[];
};

export type ReservationContractSyncReset = {
  contractId: string;
  logicalUnitIndex: number;
  reasons: ReservationContractSyncPlanReason[];
  clearRender: boolean;
  clearLicense: boolean;
  clearPreparedJetski: boolean;
  clearPreparedAsset: boolean;
  nextStatus: "DRAFT" | null;
};

export type ReservationContractSyncBlocker = {
  status: 409;
  code: string;
  message: string;
  contractIds: string[];
  reasons: ReservationContractSyncPlanReason[];
};

export type ReservationContractSyncPlan = {
  requiredUnits: number;
  desiredTemplateCode: string | null;
  desiredRequiresLicense: boolean;
  expectedResourceKind: ReservationContractPreparedResourceKind | null;
  keep: ReservationContractSyncKeep[];
  create: ReservationContractSyncCreate[];
  void: ReservationContractSyncVoid[];
  reset: ReservationContractSyncReset[];
  blockers: ReservationContractSyncBlocker[];
};

type NormalizedContract = ReservationContractSyncInputContract & {
  slot: number;
  normalizedStatus: string | null;
  normalizedTemplateCode: string | null;
  active: boolean;
  signed: boolean;
  createdMillis: number;
};

function normalizeRequiredUnits(requiredUnits: number) {
  const parsed = Math.trunc(Number(requiredUnits));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function normalizeCode(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeStatus(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function toMillis(value: Date | string | null | undefined) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveSlot(contract: ReservationContractSyncInputContract) {
  return Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
}

function inferTemplateResourceKind(
  templateCode: string | null
): ReservationContractPreparedResourceKind | null {
  if (templateCode === "JETSKI_LICENSED") return "jetski";
  if (templateCode === "BOAT_LICENSED") return "asset";
  return null;
}

function inferTemplateRequiresLicense(templateCode: string | null) {
  if (!templateCode) return null;
  return templateCode.endsWith("_LICENSED") ? true : false;
}

function contractRequiresLicense(contract: NormalizedContract) {
  if (typeof contract.requiresLicense === "boolean") return contract.requiresLicense;
  return inferTemplateRequiresLicense(contract.normalizedTemplateCode);
}

function hasLicenseData(contract: NormalizedContract) {
  return Boolean(
    contract.licenseSchool?.trim() ||
      contract.licenseType?.trim() ||
      contract.licenseNumber?.trim()
  );
}

function hasRenderData(contract: NormalizedContract) {
  return Boolean(
    contract.renderedHtml?.trim() ||
      contract.renderedPdfKey?.trim() ||
      contract.renderedPdfUrl?.trim()
  );
}

function normalizeContract(contract: ReservationContractSyncInputContract): NormalizedContract {
  const normalizedStatus = normalizeStatus(contract.status);
  return {
    ...contract,
    slot: resolveSlot(contract),
    normalizedStatus,
    normalizedTemplateCode: normalizeCode(contract.templateCode),
    active: normalizedStatus !== "VOID" && !contract.supersededAt,
    signed: normalizedStatus === "SIGNED",
    createdMillis: toMillis(contract.createdAt),
  };
}

function sortMostRelevantFirst(left: NormalizedContract, right: NormalizedContract) {
  if (left.signed !== right.signed) return left.signed ? -1 : 1;
  const leftReady = left.normalizedStatus === "READY";
  const rightReady = right.normalizedStatus === "READY";
  if (leftReady !== rightReady) return leftReady ? -1 : 1;
  const timeDiff = right.createdMillis - left.createdMillis;
  if (timeDiff !== 0) return timeDiff;
  return Number(right.unitIndex ?? 0) - Number(left.unitIndex ?? 0);
}

function uniqueReasons(reasons: ReservationContractSyncPlanReason[]) {
  return Array.from(new Set(reasons));
}

function blocker(args: {
  code: string;
  message: string;
  contracts: NormalizedContract[];
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

function evaluateContractCompatibility(
  contract: NormalizedContract,
  args: {
    templateCode: string | null;
    requiresLicense: boolean;
    expectedResourceKind: ReservationContractPreparedResourceKind | null;
    expectedAssetType: string | null;
  }
) {
  const reasons: ReservationContractSyncPlanReason[] = [];
  const currentResourceKind =
    contract.expectedResourceKind ?? inferTemplateResourceKind(contract.normalizedTemplateCode);
  const currentRequiresLicense = contractRequiresLicense(contract);

  if (
    contract.normalizedTemplateCode &&
    args.templateCode &&
    contract.normalizedTemplateCode !== args.templateCode
  ) {
    reasons.push("template-incompatible");
  }

  if (currentRequiresLicense !== null && currentRequiresLicense !== args.requiresLicense) {
    reasons.push("license-incompatible");
  }

  if (
    currentResourceKind &&
    args.expectedResourceKind &&
    currentResourceKind !== args.expectedResourceKind
  ) {
    reasons.push("resource-kind-incompatible");
  }

  if (
    args.expectedAssetType &&
    contract.preparedAssetType &&
    normalizeCode(contract.preparedAssetType) !== normalizeCode(args.expectedAssetType)
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

function buildReset(
  contract: NormalizedContract,
  args: {
    reasons: ReservationContractSyncPlanReason[];
    requiresLicense: boolean;
    expectedResourceKind: ReservationContractPreparedResourceKind | null;
    materialChange: boolean;
  }
): ReservationContractSyncReset | null {
  const reasons = [...args.reasons];
  let clearPreparedJetski = false;
  let clearPreparedAsset = false;
  let clearLicense = false;

  if (args.expectedResourceKind === "asset" && contract.preparedJetskiId) {
    clearPreparedJetski = true;
    reasons.push("prepared-jetski-incompatible");
  }

  if (args.expectedResourceKind === "jetski" && contract.preparedAssetId) {
    clearPreparedAsset = true;
    reasons.push("prepared-asset-incompatible");
  }

  if (reasons.includes("prepared-asset-type-incompatible") && contract.preparedAssetId) {
    clearPreparedAsset = true;
  }

  if (!args.requiresLicense && hasLicenseData(contract)) {
    clearLicense = true;
    reasons.push("license-no-longer-required");
  }

  if (args.requiresLicense && contractRequiresLicense(contract) === false) {
    reasons.push("license-now-required");
  }

  if (args.materialChange) {
    reasons.push("material-change");
  }

  const unique = uniqueReasons(reasons);
  if (unique.length === 0) return null;

  const shouldResetToDraft =
    contract.normalizedStatus === "READY" &&
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

  const finalReasons = shouldResetToDraft
    ? uniqueReasons([...unique, "ready-reset-to-draft"])
    : unique;

  return {
    contractId: contract.id,
    logicalUnitIndex: contract.slot,
    reasons: finalReasons,
    clearRender:
      args.materialChange ||
      hasRenderData(contract) ||
      finalReasons.some(
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
    nextStatus: shouldResetToDraft ? "DRAFT" : null,
  };
}

export function planReservationContractSync(
  args: PlanReservationContractSyncArgs
): ReservationContractSyncPlan {
  const requiredUnits = normalizeRequiredUnits(args.requiredUnits);
  const desiredTemplateCode = normalizeCode(args.templateCode);
  const expectedResourceKind = args.expectedResourceKind ?? null;
  const expectedAssetType = normalizeCode(args.expectedAssetType);
  const materialChange = Boolean(args.materialChange);
  const contracts = args.contracts.map(normalizeContract);
  const activeContracts = contracts.filter((contract) => contract.active && contract.slot >= 1);
  const signedContracts = activeContracts.filter((contract) => contract.signed);

  const blockers: ReservationContractSyncBlocker[] = [];

  if (signedContracts.length > requiredUnits) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_REDUCTION",
        message: "No puedes reducir por debajo de contratos firmados activos.",
        contracts: signedContracts,
        reasons: ["active-signed-contracts-exceed-required-units"],
      })
    );
  }

  const signedOutOfRange = signedContracts.filter((contract) => contract.slot > requiredUnits);
  if (signedOutOfRange.length > 0) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_OUT_OF_RANGE",
        message: "No puedes retirar una unidad con contrato firmado activo.",
        contracts: signedOutOfRange,
        reasons: ["signed-contract-out-of-range"],
      })
    );
  }

  const signedTemplateIncompatible: NormalizedContract[] = [];
  const signedLicenseIncompatible: NormalizedContract[] = [];
  const signedResourceIncompatible: NormalizedContract[] = [];

  for (const contract of signedContracts) {
    const compatibility = evaluateContractCompatibility(contract, {
      templateCode: desiredTemplateCode,
      requiresLicense: args.requiresLicense,
      expectedResourceKind,
      expectedAssetType,
    });

    if (compatibility.reasons.includes("template-incompatible")) {
      signedTemplateIncompatible.push(contract);
    }
    if (compatibility.reasons.includes("license-incompatible")) {
      signedLicenseIncompatible.push(contract);
    }
    if (
      compatibility.reasons.includes("resource-kind-incompatible") ||
      compatibility.reasons.includes("prepared-asset-type-incompatible")
    ) {
      signedResourceIncompatible.push(contract);
    }
  }

  if (signedTemplateIncompatible.length > 0) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_TEMPLATE_INCOMPATIBLE",
        message: "Hay contratos firmados con una plantilla incompatible.",
        contracts: signedTemplateIncompatible,
        reasons: ["signed-template-incompatible"],
      })
    );
  }

  if (signedLicenseIncompatible.length > 0) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_LICENSE_INCOMPATIBLE",
        message: "Hay contratos firmados con requisitos de licencia incompatibles.",
        contracts: signedLicenseIncompatible,
        reasons: ["signed-license-incompatible"],
      })
    );
  }

  if (signedResourceIncompatible.length > 0) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_RESOURCE_INCOMPATIBLE",
        message: "Hay contratos firmados con un recurso o tipo de contrato incompatible.",
        contracts: signedResourceIncompatible,
        reasons: ["signed-resource-incompatible"],
      })
    );
  }

  if (args.blockSignedOnMaterialChange && materialChange && signedContracts.length > 0) {
    blockers.push(
      blocker({
        code: "SIGNED_CONTRACT_MATERIAL_CHANGE",
        message: "Hay contratos firmados activos y el cambio afecta al contenido contractual.",
        contracts: signedContracts,
        reasons: ["signed-material-change"],
      })
    );
  }

  const basePlan = {
    requiredUnits,
    desiredTemplateCode,
    desiredRequiresLicense: args.requiresLicense,
    expectedResourceKind,
  };

  if (blockers.length > 0) {
    return {
      ...basePlan,
      keep: signedContracts.map((contract) => ({
        contractId: contract.id,
        logicalUnitIndex: contract.slot,
        status: contract.normalizedStatus,
      })),
      create: [],
      void: [],
      reset: [],
      blockers,
    };
  }

  const bySlot = new Map<number, NormalizedContract[]>();
  for (const contract of activeContracts) {
    const bucket = bySlot.get(contract.slot) ?? [];
    bucket.push(contract);
    bySlot.set(contract.slot, bucket);
  }

  const keep: ReservationContractSyncKeep[] = [];
  const create: ReservationContractSyncCreate[] = [];
  const voidPlan: ReservationContractSyncVoid[] = [];
  const reset: ReservationContractSyncReset[] = [];
  const keptIds = new Set<string>();
  const voidedIds = new Set<string>();

  function addVoid(contract: NormalizedContract, reasons: ReservationContractSyncPlanReason[]) {
    if (contract.signed || voidedIds.has(contract.id)) return;
    voidedIds.add(contract.id);
    voidPlan.push({
      contractId: contract.id,
      logicalUnitIndex: contract.slot,
      reasons: uniqueReasons(reasons),
    });
  }

  function addReset(
    contract: NormalizedContract,
    reasons: ReservationContractSyncPlanReason[]
  ) {
    if (contract.signed) return;
    const existing = reset.find((item) => item.contractId === contract.id);
    const next = buildReset(contract, {
      reasons,
      requiresLicense: args.requiresLicense,
      expectedResourceKind,
      materialChange,
    });
    if (!next) return;
    if (!existing) {
      reset.push(next);
      return;
    }

    existing.reasons = uniqueReasons([...existing.reasons, ...next.reasons]);
    existing.clearRender = existing.clearRender || next.clearRender;
    existing.clearLicense = existing.clearLicense || next.clearLicense;
    existing.clearPreparedJetski = existing.clearPreparedJetski || next.clearPreparedJetski;
    existing.clearPreparedAsset = existing.clearPreparedAsset || next.clearPreparedAsset;
    existing.nextStatus = existing.nextStatus ?? next.nextStatus;
  }

  for (let slot = 1; slot <= requiredUnits; slot += 1) {
    const bucket = [...(bySlot.get(slot) ?? [])].sort(sortMostRelevantFirst);
    const signed = bucket.find((contract) => contract.signed);

    if (signed) {
      keep.push({
        contractId: signed.id,
        logicalUnitIndex: signed.slot,
        status: signed.normalizedStatus,
      });
      keptIds.add(signed.id);
      for (const contract of bucket) {
        if (contract.id !== signed.id) addVoid(contract, ["duplicate-contract"]);
      }
      continue;
    }

    let keptUnsigned: NormalizedContract | null = null;
    for (const contract of bucket) {
      const compatibility = evaluateContractCompatibility(contract, {
        templateCode: desiredTemplateCode,
        requiresLicense: args.requiresLicense,
        expectedResourceKind,
        expectedAssetType,
      });

      if (!compatibility.compatible) {
        addVoid(contract, compatibility.reasons);
        addReset(contract, compatibility.reasons);
        continue;
      }

      if (!keptUnsigned) {
        keptUnsigned = contract;
        keep.push({
          contractId: contract.id,
          logicalUnitIndex: contract.slot,
          status: contract.normalizedStatus,
        });
        keptIds.add(contract.id);
        addReset(contract, compatibility.reasons);
      } else {
        addVoid(contract, ["duplicate-contract"]);
      }
    }

    if (!keptUnsigned) {
      create.push({
        logicalUnitIndex: slot,
        templateCode: desiredTemplateCode,
        requiresLicense: args.requiresLicense,
        expectedResourceKind,
      });
    }
  }

  for (const contract of activeContracts) {
    if (contract.slot <= requiredUnits || keptIds.has(contract.id)) continue;
    addVoid(contract, ["surplus-contract"]);
  }

  keep.sort((left, right) => left.logicalUnitIndex - right.logicalUnitIndex);
  create.sort((left, right) => left.logicalUnitIndex - right.logicalUnitIndex);
  voidPlan.sort((left, right) => {
    const slotDiff = left.logicalUnitIndex - right.logicalUnitIndex;
    if (slotDiff !== 0) return slotDiff;
    return left.contractId.localeCompare(right.contractId);
  });
  reset.sort((left, right) => {
    const slotDiff = left.logicalUnitIndex - right.logicalUnitIndex;
    if (slotDiff !== 0) return slotDiff;
    return left.contractId.localeCompare(right.contractId);
  });

  return {
    ...basePlan,
    keep,
    create,
    void: voidPlan,
    reset,
    blockers: [],
  };
}
