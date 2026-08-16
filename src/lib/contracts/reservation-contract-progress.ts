import {
  countReadyVisibleContracts,
  countReadyVisibleContractsByTargets,
  pickVisibleContractsByLogicalUnit,
  pickVisibleContractsByTargets,
  type ContractLike,
  type ContractVisibilityTarget,
} from "./active-contracts";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
  type ReservationContractRequirementItem,
} from "@/lib/reservation-contract-requirements";

export type ReservationContractsState = "OK" | "PARTIAL" | "MISSING";

type ContractProgressReservationLike = {
  quantity?: number | null;
  isLicense?: boolean | null;
  serviceId?: string | null;
  optionId?: string | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  items?: ReservationContractRequirementItem[] | null;
  contracts?: ContractLike[] | null;
};

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

export function buildReservationContractProgressFromReservation<
  T extends ContractProgressReservationLike
>(reservation: T) {
  const requirements = buildReservationContractRequirements({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceId: reservation.serviceId ?? null,
    optionId: reservation.optionId ?? null,
    serviceName: reservation.service?.name ?? null,
    serviceCategory: reservation.service?.category ?? null,
    durationMinutes: reservation.option?.durationMinutes ?? null,
    pax: reservation.pax ?? null,
    totalPriceCents: reservation.totalPriceCents ?? null,
    items: reservation.items ?? [],
  });
  const targets = reservationContractRequirementsToSyncTargets(requirements);
  const progress = buildReservationContractProgressForTargets(
    reservation.contracts ?? [],
    targets
  );

  return {
    ...progress,
    requirements,
    targets,
  };
}
