import { ReservationStatus, ReservationUnitStatus } from "@prisma/client";

export function deriveReservationStatusFromUnits(
  units: Array<{ status: ReservationUnitStatus }>
): ReservationStatus {
  if (!units.length) return ReservationStatus.WAITING;

  const hasInSea = units.some((unit) => unit.status === ReservationUnitStatus.IN_SEA);
  const hasReady = units.some((unit) => unit.status === ReservationUnitStatus.READY_FOR_PLATFORM);
  const hasWaiting = units.some((unit) => unit.status === ReservationUnitStatus.WAITING);
  const allCompleted = units.every((unit) => unit.status === ReservationUnitStatus.COMPLETED);
  const allCanceled = units.every((unit) => unit.status === ReservationUnitStatus.CANCELED);

  if (hasInSea) return ReservationStatus.IN_SEA;
  if (hasReady) return ReservationStatus.READY_FOR_PLATFORM;
  if (hasWaiting) return ReservationStatus.WAITING;
  if (allCompleted) return ReservationStatus.COMPLETED;
  if (allCanceled) return ReservationStatus.CANCELED;

  return ReservationStatus.WAITING;
}

export function hasPendingOperationalUnits(
  units: Array<{ status: ReservationUnitStatus }>
) {
  return units.some(
    (unit) =>
      unit.status === ReservationUnitStatus.READY_FOR_PLATFORM ||
      unit.status === ReservationUnitStatus.IN_SEA
  );
}
