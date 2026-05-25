import { ReservationUnitStatus } from "@prisma/client";

import type { OperationalUnitSnapshot } from "@/lib/reservation-operational-units";

export type ExistingReservationUnitSnapshot = {
  id: string;
  unitIndex: number | null;
  status: ReservationUnitStatus;
};

export function computeReservationUnitSyncPlan(args: {
  requiredUnits: OperationalUnitSnapshot[];
  existingUnits: ExistingReservationUnitSnapshot[];
  readyAt?: Date;
}) {
  const byIndex = new Map(
    args.existingUnits.map((unit) => [Number(unit.unitIndex ?? 0), unit])
  );
  const requiredIndexes = new Set(args.requiredUnits.map((unit) => unit.unitIndex));

  const extraUnitIds = args.existingUnits
    .filter(
      (unit) =>
        !requiredIndexes.has(Number(unit.unitIndex ?? 0)) &&
        unit.status !== ReservationUnitStatus.CANCELED
    )
    .map((unit) => unit.id);

  const creates: Array<{
    unitIndex: number;
    status: ReservationUnitStatus;
    data: Omit<OperationalUnitSnapshot, "unitIndex"> & {
      readyForPlatformAt?: Date;
    };
  }> = [];

  const updates: Array<{
    id: string;
    data: Omit<OperationalUnitSnapshot, "unitIndex"> & {
      readyForPlatformAt?: Date;
      status?: ReservationUnitStatus;
    };
  }> = [];

  for (const snapshot of args.requiredUnits) {
    const existing = byIndex.get(snapshot.unitIndex);
    const data = {
      reservationItemId: snapshot.reservationItemId,
      serviceId: snapshot.serviceId,
      optionId: snapshot.optionId,
      serviceCategory: snapshot.serviceCategory,
      serviceName: snapshot.serviceName,
      durationMinutesSnapshot: snapshot.durationMinutesSnapshot,
      quantitySnapshot: snapshot.quantitySnapshot,
      paxSnapshot: snapshot.paxSnapshot,
      ...(args.readyAt ? { readyForPlatformAt: args.readyAt } : {}),
    };

    if (!existing) {
      creates.push({
        unitIndex: snapshot.unitIndex,
        status: args.readyAt
          ? ReservationUnitStatus.READY_FOR_PLATFORM
          : ReservationUnitStatus.WAITING,
        data,
      });
      continue;
    }

    updates.push({
      id: existing.id,
      data: {
        ...data,
        ...((args.readyAt && existing.status === ReservationUnitStatus.WAITING) ||
        existing.status === ReservationUnitStatus.CANCELED
          ? {
              status: args.readyAt
                ? ReservationUnitStatus.READY_FOR_PLATFORM
                : ReservationUnitStatus.WAITING,
            }
          : {}),
      },
    });
  }

  return {
    extraUnitIds,
    creates,
    updates,
  };
}
