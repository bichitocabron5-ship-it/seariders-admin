import {
  countReadyVisibleContracts,
  countReadyVisibleContractsByTargets,
  pickVisibleContractsByLogicalUnit,
  pickVisibleContractsByTargets,
  type ContractLike,
  type ContractVisibilityTarget,
} from "./active-contracts";

export type ReservationContractsState = "OK" | "PARTIAL" | "MISSING";

function normalizeRequiredUnits(requiredUnits: number | null | undefined) {
  const parsed = Math.trunc(Number(requiredUnits ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export function buildReservationContractProgress<T extends ContractLike>(
  contracts: T[],
  requiredUnitsInput: number | null | undefined
) {
  const requiredUnits = normalizeRequiredUnits(requiredUnitsInput);
  const activeContracts = pickVisibleContractsByLogicalUnit(contracts, requiredUnits);
  const readyCount = countReadyVisibleContracts(contracts, requiredUnits);
  const needsContracts = requiredUnits > 0 && readyCount < requiredUnits;
  const contractsState: ReservationContractsState =
    requiredUnits <= 0
      ? "OK"
      : readyCount >= requiredUnits
        ? "OK"
        : readyCount > 0
          ? "PARTIAL"
          : "MISSING";

  return {
    requiredUnits,
    readyCount,
    needsContracts,
    contractsState,
    contracts: activeContracts,
  };
}

export function buildReservationContractProgressForTargets<T extends ContractLike>(
  contracts: T[],
  targets: readonly ContractVisibilityTarget[]
) {
  const requiredUnits = targets.length;
  const activeContracts = pickVisibleContractsByTargets(contracts, targets);
  const readyCount = countReadyVisibleContractsByTargets(contracts, targets);
  const needsContracts = requiredUnits > 0 && readyCount < requiredUnits;
  const contractsState: ReservationContractsState =
    requiredUnits <= 0
      ? "OK"
      : readyCount >= requiredUnits
        ? "OK"
        : readyCount > 0
          ? "PARTIAL"
          : "MISSING";

  return {
    requiredUnits,
    readyCount,
    needsContracts,
    contractsState,
    contracts: activeContracts,
  };
}
