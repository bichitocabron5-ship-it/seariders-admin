type ContractLike = {
  unitIndex: number | null | undefined;
  logicalUnitIndex?: number | null | undefined;
  status?: string | null | undefined;
  supersededAt?: Date | string | null | undefined;
  createdAt?: Date | string | null | undefined;
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
