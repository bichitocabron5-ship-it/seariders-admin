import type { Prisma } from "@prisma/client";
import { ReservationUnitStatus } from "@prisma/client";

import { buildOperationalUnitSnapshots } from "@/lib/reservation-operational-units";

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

  const byIndex = new Map(existingUnits.map((unit) => [Number(unit.unitIndex ?? 0), unit]));
  const requiredIndexes = new Set(requiredUnits.map((unit) => unit.unitIndex));

  const extraUnitIds = existingUnits
    .filter(
      (unit) =>
        !requiredIndexes.has(Number(unit.unitIndex ?? 0)) &&
        unit.status !== ReservationUnitStatus.CANCELED
    )
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

  for (const snapshot of requiredUnits) {
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
      ...(readyAt ? { readyForPlatformAt: readyAt } : {}),
    };

    if (!existing) {
      await tx.reservationUnit.create({
        data: {
          reservationId,
          unitIndex: snapshot.unitIndex,
          status: readyAt ? ReservationUnitStatus.READY_FOR_PLATFORM : ReservationUnitStatus.WAITING,
          ...data,
        },
      });
      continue;
    }

    await tx.reservationUnit.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...((readyAt &&
          existing.status === ReservationUnitStatus.WAITING) ||
        existing.status === ReservationUnitStatus.CANCELED
          ? {
              status: readyAt ? ReservationUnitStatus.READY_FOR_PLATFORM : ReservationUnitStatus.WAITING,
            }
          : {}),
      },
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
