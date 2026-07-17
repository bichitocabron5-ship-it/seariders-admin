export type ContractLike = {
  unitIndex: number | null | undefined;
  logicalUnitIndex?: number | null | undefined;
  reservationItemId?: string | null | undefined;
  status?: string | null | undefined;
  supersededAt?: Date | string | null | undefined;
  createdAt?: Date | string | null | undefined;
};

export type ContractVisibilityTarget = {
  logicalUnitIndex: number;
  reservationItemId?: string | null | undefined;
};

function toMillis(value: Date | string | null | undefined) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

export function contractLogicalUnitIndex(contract: ContractLike) {
  return Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
}

export function isContractSuperseded(contract: ContractLike) {
  return Boolean(contract.supersededAt) || String(contract.status ?? "").toUpperCase() === "VOID";
}

export function pickVisibleContractsByLogicalUnit<T extends ContractLike>(
  contracts: T[],
  requiredUnits: number
) {
  const bySlot = new Map<number, T[]>();

  for (const contract of contracts) {
    const slot = contractLogicalUnitIndex(contract);
    if (slot < 1 || slot > requiredUnits) continue;
    const bucket = bySlot.get(slot) ?? [];
    bucket.push(contract);
    bySlot.set(slot, bucket);
  }

  const visible: T[] = [];
  for (let slot = 1; slot <= requiredUnits; slot++) {
    const bucket = bySlot.get(slot) ?? [];
    if (!bucket.length) continue;

    const candidates = bucket.filter((contract) => !isContractSuperseded(contract));
    if (!candidates.length) continue;

    candidates.sort((a, b) => {
      const timeDiff = toMillis(b.createdAt) - toMillis(a.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return Number(b.unitIndex ?? 0) - Number(a.unitIndex ?? 0);
    });

    visible.push(candidates[0]);
  }

  visible.sort((a, b) => contractLogicalUnitIndex(a) - contractLogicalUnitIndex(b));
  return visible;
}

export function countReadyVisibleContracts<T extends ContractLike>(
  contracts: T[],
  requiredUnits: number
) {
  return pickVisibleContractsByLogicalUnit(contracts, requiredUnits).filter(
    (contract) => contract.status === "READY" || contract.status === "SIGNED"
  ).length;
}

export function countLockedVisibleContracts<T extends ContractLike>(
  contracts: T[],
  requiredUnits: number
) {
  return pickVisibleContractsByLogicalUnit(contracts, requiredUnits).filter(
    (contract) => contract.status === "SIGNED"
  ).length;
}

export function canEditReservationLegalContent<T extends ContractLike>(
  contracts: T[],
  requiredUnits: number
) {
  return countLockedVisibleContracts(contracts, requiredUnits) === 0;
}

function targetReservationItemId(target: ContractVisibilityTarget) {
  const value = String(target.reservationItemId ?? "").trim();
  return value.length ? value : null;
}

function contractReservationItemId(contract: ContractLike) {
  const value = String(contract.reservationItemId ?? "").trim();
  return value.length ? value : null;
}

function sortVisibleCandidates<T extends ContractLike>(candidates: T[]) {
  return [...candidates].sort((a, b) => {
    const aSigned = String(a.status ?? "").toUpperCase() === "SIGNED";
    const bSigned = String(b.status ?? "").toUpperCase() === "SIGNED";
    if (aSigned !== bSigned) return aSigned ? -1 : 1;

    const aReady = String(a.status ?? "").toUpperCase() === "READY";
    const bReady = String(b.status ?? "").toUpperCase() === "READY";
    if (aReady !== bReady) return aReady ? -1 : 1;

    const timeDiff = toMillis(b.createdAt) - toMillis(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return Number(b.unitIndex ?? 0) - Number(a.unitIndex ?? 0);
  });
}

export function pickVisibleContractsByTargets<T extends ContractLike>(
  contracts: T[],
  targets: readonly ContractVisibilityTarget[]
) {
  const activeContracts = contracts.filter((contract) => !isContractSuperseded(contract));
  const targetItemIds = new Set(
    targets
      .map((target) => targetReservationItemId(target))
      .filter((itemId): itemId is string => Boolean(itemId))
  );
  const allowLegacySlotCandidates = targetItemIds.size <= 1;
  const usedIds = new Set<T>();
  const visible: T[] = [];

  for (const target of [...targets].sort((a, b) => a.logicalUnitIndex - b.logicalUnitIndex)) {
    const targetItemId = targetReservationItemId(target);
    const targetSlot = Number(target.logicalUnitIndex ?? 0);
    const exactCandidates = activeContracts.filter(
      (contract) =>
        !usedIds.has(contract) &&
        contractReservationItemId(contract) === targetItemId &&
        contractLogicalUnitIndex(contract) === targetSlot
    );
    const itemCandidates =
      targetItemId && exactCandidates.length === 0
        ? activeContracts.filter(
            (contract) =>
              !usedIds.has(contract) &&
              contractReservationItemId(contract) === targetItemId
          )
        : [];
    const legacySlotCandidates =
      targetItemId &&
      allowLegacySlotCandidates &&
      exactCandidates.length === 0 &&
      itemCandidates.length === 0
        ? activeContracts.filter(
            (contract) =>
              !usedIds.has(contract) &&
              contractReservationItemId(contract) === null &&
              contractLogicalUnitIndex(contract) === targetSlot
          )
        : [];

    const candidates = sortVisibleCandidates([...exactCandidates, ...itemCandidates, ...legacySlotCandidates]);
    const selected = candidates[0];
    if (!selected) continue;

    usedIds.add(selected);
    visible.push(selected);
  }

  visible.sort((a, b) => contractLogicalUnitIndex(a) - contractLogicalUnitIndex(b));
  return visible;
}

export function countReadyVisibleContractsByTargets<T extends ContractLike>(
  contracts: T[],
  targets: readonly ContractVisibilityTarget[]
) {
  return pickVisibleContractsByTargets(contracts, targets).filter(
    (contract) => contract.status === "READY" || contract.status === "SIGNED"
  ).length;
}

export function countLockedVisibleContractsByTargets<T extends ContractLike>(
  contracts: T[],
  targets: readonly ContractVisibilityTarget[]
) {
  return pickVisibleContractsByTargets(contracts, targets).filter(
    (contract) => contract.status === "SIGNED"
  ).length;
}

export function listMissingLogicalUnits<T extends ContractLike>(
  contracts: T[],
  requiredUnits: number
) {
  const visible = pickVisibleContractsByLogicalUnit(contracts, requiredUnits);
  const slots = new Set(visible.map((contract) => contractLogicalUnitIndex(contract)));
  const missing: number[] = [];
  for (let slot = 1; slot <= requiredUnits; slot++) {
    if (!slots.has(slot)) missing.push(slot);
  }
  return missing;
}

export function listMissingContractTargets<T extends ContractLike>(
  contracts: T[],
  targets: readonly ContractVisibilityTarget[]
) {
  const visible = pickVisibleContractsByTargets(contracts, targets);
  const visibleKeys = new Set(
    visible.map((contract) => {
      const itemId = contractReservationItemId(contract);
      return `${itemId ?? "legacy"}:${contractLogicalUnitIndex(contract)}`;
    })
  );

  return targets.filter((target) => {
    const itemId = targetReservationItemId(target);
    return !visibleKeys.has(`${itemId ?? "legacy"}:${Number(target.logicalUnitIndex ?? 0)}`);
  });
}
