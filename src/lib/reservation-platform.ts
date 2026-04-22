import type { Prisma } from "@prisma/client";

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
