import type { Prisma } from "@prisma/client";
import { ReservationUnitStatus } from "@prisma/client";

import { buildOperationalUnitSnapshots } from "@/lib/reservation-operational-units";
import { computeReservationUnitSyncPlan } from "@/lib/reservation-platform-sync";

export type ReservationPlatformUnitsInput = {
  id: string;
  quantity?: number | null;
  isPackParent?: boolean | null;
  parentReservationId?: string | null;
  serviceCategory?: string | null;
  items?: Array<unknown>;
};

async function loadReservationOperationalUnitsTx(
  tx: Prisma.TransactionClient,
  reservationId: string
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      quantity: true,
      pax: true,
      isPackParent: true,
      parentReservationId: true,
      service: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      option: {
        select: {
          id: true,
          durationMinutes: true,
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          quantity: true,
          pax: true,
          isExtra: true,
          service: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          option: {
            select: {
              id: true,
              durationMinutes: true,
            },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new Error("Reserva no existe");
  }

  return reservation;
}

async function syncReservationPlatformUnitsInternalTx(
  tx: Prisma.TransactionClient,
  reservationId: string,
  readyAt?: Date
) {
  const reservation = await loadReservationOperationalUnitsTx(tx, reservationId);
  if (reservation.isPackParent && !reservation.parentReservationId) return;

  const requiredUnits = buildOperationalUnitSnapshots({
    items: reservation.items ?? [],
    fallback: {
      quantity: reservation.quantity,
      pax: reservation.pax,
      service: reservation.service,
      option: reservation.option,
    },
  });

  const existingUnits = await tx.reservationUnit.findMany({
    where: { reservationId },
    select: {
      id: true,
      unitIndex: true,
      status: true,
    },
    orderBy: { unitIndex: "asc" },
  });
  const syncPlan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits,
    readyAt,
  });

  if (syncPlan.extraUnitIds.length > 0) {
    await tx.reservationUnit.updateMany({
      where: { id: { in: syncPlan.extraUnitIds } },
      data: {
        status: ReservationUnitStatus.CANCELED,
        jetskiId: null,
        readyForPlatformAt: null,
      },
    });
  }

  for (const create of syncPlan.creates) {
    await tx.reservationUnit.create({
      data: {
        reservationId,
        unitIndex: create.unitIndex,
        status: create.status,
        ...create.data,
      },
    });
  }

  for (const update of syncPlan.updates) {
    await tx.reservationUnit.update({
      where: { id: update.id },
      data: update.data,
    });
  }
}

export async function ensureReservationPlatformUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: ReservationPlatformUnitsInput,
  readyAt?: Date
) {
  await syncReservationPlatformUnitsInternalTx(tx, reservation.id, readyAt);
}

export async function syncReservationPlatformUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: ReservationPlatformUnitsInput,
  readyAt?: Date
) {
  await syncReservationPlatformUnitsInternalTx(tx, reservation.id, readyAt);
}
