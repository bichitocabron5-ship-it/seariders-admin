import type { Prisma } from "@prisma/client";
import { ReservationUnitStatus } from "@prisma/client";

import { computeRequiredPlatformUnits } from "@/lib/reservation-rules";

export type ReservationPlatformUnitsInput = {
  id: string;
  quantity: number | null;
  isPackParent: boolean | null;
  parentReservationId: string | null;
  serviceCategory?: string | null;
  items: Array<{
    quantity: number | null;
    isExtra: boolean;
    service: { category: string | null } | null;
  }>;
};

export async function ensureReservationPlatformUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: ReservationPlatformUnitsInput,
  readyAt?: Date
) {
  if (reservation.isPackParent && !reservation.parentReservationId) return;

  const requiredUnits = computeRequiredPlatformUnits({
    quantity: reservation.quantity,
    serviceCategory: reservation.serviceCategory ?? null,
    items: reservation.items ?? [],
  });
  if (requiredUnits <= 0) return;

  const existing = await tx.reservationUnit.findMany({
    where: { reservationId: reservation.id },
    select: { unitIndex: true },
  });
  const existingIndexes = new Set(existing.map((unit) => Number(unit.unitIndex)));

  const toCreate: Array<{
    reservationId: string;
    unitIndex: number;
    readyForPlatformAt?: Date;
  }> = [];

  for (let index = 1; index <= requiredUnits; index++) {
    if (!existingIndexes.has(index)) {
      toCreate.push({
        reservationId: reservation.id,
        unitIndex: index,
        ...(readyAt ? { readyForPlatformAt: readyAt } : {}),
      });
    }
  }

  if (toCreate.length > 0) {
    await tx.reservationUnit.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }
}

export async function syncReservationPlatformUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: ReservationPlatformUnitsInput,
  readyAt?: Date
) {
  if (reservation.isPackParent && !reservation.parentReservationId) return;

  const requiredUnits = computeRequiredPlatformUnits({
    quantity: reservation.quantity,
    serviceCategory: reservation.serviceCategory ?? null,
    items: reservation.items ?? [],
  });

  const existingUnits = await tx.reservationUnit.findMany({
    where: { reservationId: reservation.id },
    select: {
      id: true,
      unitIndex: true,
      status: true,
    },
    orderBy: { unitIndex: "asc" },
  });

  const extraUnitIds = existingUnits
    .filter((unit) => Number(unit.unitIndex ?? 0) > requiredUnits && unit.status !== ReservationUnitStatus.CANCELED)
    .map((unit) => unit.id);

  if (extraUnitIds.length > 0) {
    await tx.reservationUnit.updateMany({
      where: { id: { in: extraUnitIds } },
      data: {
        status: ReservationUnitStatus.CANCELED,
        jetskiId: null,
        readyForPlatformAt: null,
      },
    });
  }

  const byIndex = new Map(existingUnits.map((unit) => [Number(unit.unitIndex ?? 0), unit]));
  const toCreate: Array<{
    reservationId: string;
    unitIndex: number;
    status: ReservationUnitStatus;
    readyForPlatformAt?: Date;
  }> = [];
  const toReactivateIds: string[] = [];

  for (let index = 1; index <= requiredUnits; index++) {
    const existing = byIndex.get(index);
    if (!existing) {
      toCreate.push({
        reservationId: reservation.id,
        unitIndex: index,
        status: readyAt ? ReservationUnitStatus.READY_FOR_PLATFORM : ReservationUnitStatus.WAITING,
        ...(readyAt ? { readyForPlatformAt: readyAt } : {}),
      });
      continue;
    }

    if (existing.status === ReservationUnitStatus.CANCELED) {
      toReactivateIds.push(existing.id);
    }
  }

  if (toCreate.length > 0) {
    await tx.reservationUnit.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  if (toReactivateIds.length > 0) {
    await tx.reservationUnit.updateMany({
      where: { id: { in: toReactivateIds } },
      data: {
        status: readyAt ? ReservationUnitStatus.READY_FOR_PLATFORM : ReservationUnitStatus.WAITING,
        readyForPlatformAt: readyAt ?? null,
      },
    });
  }
}
