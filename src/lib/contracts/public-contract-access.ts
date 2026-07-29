import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";
import { isContractSuperseded, pickVisibleContractsByTargets } from "@/lib/contracts/active-contracts";

export type PublicContractAccessErrorCode =
  | "CONTRACT_NOT_IN_RESERVATION"
  | "CONTRACT_RESERVATION_ITEM_MISMATCH"
  | "CONTRACT_INACTIVE"
  | "CONTRACT_NOT_VISIBLE";

type PublicContractAccessItem = {
  id?: string | null;
  reservationId?: string | null;
  serviceId?: string | null;
  optionId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  isExtra?: boolean | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

type PublicContractAccessContract = {
  id: string;
  reservationId?: string | null;
  reservationItemId?: string | null;
  unitIndex: number | null | undefined;
  logicalUnitIndex?: number | null;
  status?: string | null;
  supersededAt?: Date | string | null;
  createdAt?: Date | string | null;
  reservationItem?: { id?: string | null; reservationId?: string | null } | null;
};

type PublicContractAccessReservation = {
  id: string;
  quantity?: number | null;
  isLicense?: boolean | null;
  serviceId?: string | null;
  optionId?: string | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  service?: { name?: string | null; category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  items?: PublicContractAccessItem[] | null;
  contracts?: PublicContractAccessContract[] | null;
};

function normalizeId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function evaluatePublicContractAccess(args: {
  reservation: PublicContractAccessReservation;
  contract: PublicContractAccessContract;
}) {
  const contractReservationId = normalizeId(args.contract.reservationId);
  if (contractReservationId && contractReservationId !== args.reservation.id) {
    return { ok: false as const, code: "CONTRACT_NOT_IN_RESERVATION" as const };
  }

  const contractItemId = normalizeId(args.contract.reservationItemId);
  if (contractItemId) {
    const relationReservationId = normalizeId(args.contract.reservationItem?.reservationId);
    const reservationItem =
      args.reservation.items?.find((item) => normalizeId(item.id) === contractItemId) ?? null;

    if (
      (relationReservationId && relationReservationId !== args.reservation.id) ||
      (!relationReservationId && !reservationItem) ||
      (reservationItem?.reservationId && reservationItem.reservationId !== args.reservation.id)
    ) {
      return { ok: false as const, code: "CONTRACT_RESERVATION_ITEM_MISMATCH" as const };
    }
  }

  if (isContractSuperseded(args.contract)) {
    return { ok: false as const, code: "CONTRACT_INACTIVE" as const };
  }

  const requirements = buildReservationContractRequirements({
    quantity: args.reservation.quantity ?? 0,
    isLicense: Boolean(args.reservation.isLicense),
    serviceCategory: args.reservation.service?.category ?? null,
    serviceId: args.reservation.serviceId ?? null,
    optionId: args.reservation.optionId ?? null,
    serviceName: args.reservation.service?.name ?? null,
    durationMinutes: args.reservation.option?.durationMinutes ?? null,
    pax: args.reservation.pax ?? null,
    totalPriceCents: args.reservation.totalPriceCents ?? null,
    items: args.reservation.items ?? [],
  });
  const targets = reservationContractRequirementsToSyncTargets(requirements);
  const visibleContracts = pickVisibleContractsByTargets(args.reservation.contracts ?? [], targets);

  if (!visibleContracts.some((contract) => contract.id === args.contract.id)) {
    return { ok: false as const, code: "CONTRACT_NOT_VISIBLE" as const };
  }

  return { ok: true as const, requirements, targets, visibleContracts };
}
