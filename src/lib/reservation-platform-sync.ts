import { ReservationUnitStatus } from "@prisma/client";

import type { OperationalUnitSnapshot } from "@/lib/reservation-operational-units";

export type ExistingReservationUnitSnapshot = {
  id: string;
  unitIndex: number | null;
  status: ReservationUnitStatus;
  reservationItemId?: string | null;
};

const MUTABLE_UNIT_STATUSES = new Set<ReservationUnitStatus>([
  ReservationUnitStatus.WAITING,
  ReservationUnitStatus.READY_FOR_PLATFORM,
]);

function isMutableUnit(unit: ExistingReservationUnitSnapshot) {
  return MUTABLE_UNIT_STATUSES.has(unit.status);
}

function canSatisfyRequiredUnit(unit: ExistingReservationUnitSnapshot) {
  return unit.status !== ReservationUnitStatus.CANCELED;
}

function itemKey(itemId: string, itemUnitIndex: number) {
  return `item:${itemId}:${itemUnitIndex}`;
}

function legacyKey(unitIndex: number) {
  return `legacy:${unitIndex}`;
}

function buildExistingKeyIndex(existingUnits: ExistingReservationUnitSnapshot[]) {
  const byItem = new Map<string, ExistingReservationUnitSnapshot[]>();
  const byLegacyIndex = new Map<string, ExistingReservationUnitSnapshot>();

  for (const unit of existingUnits) {
    if (!canSatisfyRequiredUnit(unit)) continue;

    const reservationItemId = unit.reservationItemId ?? null;
    if (reservationItemId) {
      const rows = byItem.get(reservationItemId) ?? [];
      rows.push(unit);
      byItem.set(reservationItemId, rows);
      continue;
    }

    const unitIndex = Number(unit.unitIndex ?? 0);
    if (unitIndex > 0) {
      byLegacyIndex.set(legacyKey(unitIndex), unit);
    }
  }

  const byItemSlot = new Map<string, ExistingReservationUnitSnapshot>();
  for (const [reservationItemId, rows] of byItem.entries()) {
    const orderedRows = [...rows].sort(
      (a, b) => Number(a.unitIndex ?? 0) - Number(b.unitIndex ?? 0)
    );
    orderedRows.forEach((unit, index) => {
      byItemSlot.set(itemKey(reservationItemId, index + 1), unit);
    });
  }

  return { byItemSlot, byLegacyIndex };
}

function nextFreeUnitIndex(
  preferred: number,
  occupiedIndexes: Set<number>
) {
  if (preferred > 0 && !occupiedIndexes.has(preferred)) {
    occupiedIndexes.add(preferred);
    return preferred;
  }

  let next = 1;
  while (occupiedIndexes.has(next)) {
    next += 1;
  }
  occupiedIndexes.add(next);
  return next;
}

export function computeReservationUnitSyncPlan(args: {
  requiredUnits: OperationalUnitSnapshot[];
  existingUnits: ExistingReservationUnitSnapshot[];
  readyAt?: Date;
}) {
  const creates: Array<{
    unitIndex: number;
    status: ReservationUnitStatus;
    data: Omit<OperationalUnitSnapshot, "unitIndex" | "itemUnitIndex"> & {
      readyForPlatformAt?: Date;
    };
  }> = [];

  const updates: Array<{
    id: string;
    data: Omit<OperationalUnitSnapshot, "unitIndex" | "itemUnitIndex"> & {
      readyForPlatformAt?: Date;
      status?: ReservationUnitStatus;
    };
  }> = [];

  const { byItemSlot, byLegacyIndex } = buildExistingKeyIndex(args.existingUnits);
  const matchedExistingIds = new Set<string>();
  const occupiedIndexes = new Set(
    args.existingUnits
      .map((unit) => Number(unit.unitIndex ?? 0))
      .filter((unitIndex) => unitIndex > 0)
  );

  for (const snapshot of args.requiredUnits) {
    const itemMatch = snapshot.reservationItemId
      ? byItemSlot.get(itemKey(snapshot.reservationItemId, snapshot.itemUnitIndex))
      : null;
    const legacyMatch = byLegacyIndex.get(legacyKey(snapshot.unitIndex)) ?? null;
    const existing = itemMatch ?? legacyMatch;
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

    if (existing) {
      matchedExistingIds.add(existing.id);
    }

    if (existing && !isMutableUnit(existing)) {
      continue;
    }

    if (!existing) {
      creates.push({
        unitIndex: nextFreeUnitIndex(snapshot.unitIndex, occupiedIndexes),
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
        ...(args.readyAt && existing.status === ReservationUnitStatus.WAITING
          ? {
              status: args.readyAt
                ? ReservationUnitStatus.READY_FOR_PLATFORM
                : ReservationUnitStatus.WAITING,
            }
          : {}),
      },
    });
  }

  const extraUnitIds = args.existingUnits
    .filter((unit) => isMutableUnit(unit) && !matchedExistingIds.has(unit.id))
    .map((unit) => unit.id);

  return {
    extraUnitIds,
    creates,
    updates,
  };
}
