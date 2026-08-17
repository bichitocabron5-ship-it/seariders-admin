import {
  MonitorRunStatus,
  ReservationStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";

export const OPEN_PLATFORM_ASSIGNMENT_STATUSES = [
  RunAssignmentStatus.QUEUED,
  RunAssignmentStatus.ACTIVE,
] as const;

export const OPEN_PLATFORM_RUN_STATUSES = [
  MonitorRunStatus.READY,
  MonitorRunStatus.IN_SEA,
] as const;

type ManualMarkInSeaDecision =
  | { ok: true; alreadyInSea: boolean; legacyFallback: boolean }
  | { ok: false; error: string };

export function evaluateManualMarkInSea(args: {
  reservationStatus: ReservationStatus | string | null | undefined;
  units: Array<{ status: ReservationUnitStatus | string | null | undefined }>;
  openAssignmentCount: number;
}): ManualMarkInSeaDecision {
  const reservationStatus = String(args.reservationStatus ?? "");
  const units = args.units ?? [];

  if (units.length > 0) {
    const allUnitsInSea = units.every(
      (unit) => unit.status === ReservationUnitStatus.IN_SEA
    );

    if (reservationStatus === ReservationStatus.IN_SEA && allUnitsInSea) {
      return { ok: true, alreadyInSea: true, legacyFallback: false };
    }

    return {
      ok: false,
      error:
        "No se puede pasar a IN_SEA manualmente una reserva con unidades de Platform. Usa la salida de Platform.",
    };
  }

  if (args.openAssignmentCount > 0) {
    return {
      ok: false,
      error:
        "No se puede pasar a IN_SEA manualmente una reserva con asignaciones activas o en cola. Usa la salida de Platform.",
    };
  }

  if (reservationStatus === ReservationStatus.IN_SEA) {
    return { ok: true, alreadyInSea: true, legacyFallback: true };
  }

  if (reservationStatus !== ReservationStatus.READY_FOR_PLATFORM) {
    return { ok: false, error: "Solo se puede pasar a IN_SEA desde READY_FOR_PLATFORM." };
  }

  return { ok: true, alreadyInSea: false, legacyFallback: true };
}
