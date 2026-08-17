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

export type ReservationPlatformUnitSyncScope = {
  kind?: "JETSKI" | "NAUTICA" | null;
  categories?: string[] | null;
};

function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

function categoryMatchesSyncScope(
  category: string | null | undefined,
  scope?: ReservationPlatformUnitSyncScope
) {
  if (!scope) return true;

  const normalized = normalizeCategory(category);
  const categories = (scope.categories ?? [])
    .map((entry) => normalizeCategory(entry))
    .filter(Boolean);

  if (categories.length > 0) {
    return normalized ? categories.includes(normalized) : false;
  }

  if (scope.kind === "JETSKI") return normalized === "JETSKI";
  if (scope.kind === "NAUTICA") return Boolean(normalized) && normalized !== "JETSKI";

  return true;
}

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
          isPackParent: true,
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
  readyAt?: Date,
  scope?: ReservationPlatformUnitSyncScope
) {
  const reservation = await loadReservationOperationalUnitsTx(tx, reservationId);

  const allRequiredUnits = buildOperationalUnitSnapshots({
    items: reservation.items ?? [],
    fallback: {
      quantity: reservation.quantity,
      pax: reservation.pax,
      isPackParent: reservation.isPackParent,
      service: reservation.service,
      option: reservation.option,
    },
  });
  const requiredUnits = scope
    ? allRequiredUnits.filter((unit) => categoryMatchesSyncScope(unit.serviceCategory, scope))
    : allRequiredUnits;

  const existingUnits = await tx.reservationUnit.findMany({
    where: { reservationId },
    select: {
      id: true,
      unitIndex: true,
      status: true,
      reservationItemId: true,
      serviceCategory: true,
    },
    orderBy: { unitIndex: "asc" },
  });
  const managedExistingUnitIds = scope
    ? new Set(
        existingUnits
          .filter((unit) => {
            if (categoryMatchesSyncScope(unit.serviceCategory, scope)) return true;

            // Legacy units may not have snapshots yet. Keep them eligible only
            // while scoping so the repair can attach the missing snapshot instead
            // of creating a duplicate row.
            return !unit.reservationItemId && !normalizeCategory(unit.serviceCategory);
          })
          .map((unit) => unit.id)
      )
    : undefined;
  const syncPlan = computeReservationUnitSyncPlan({
    requiredUnits,
    existingUnits,
    readyAt,
    managedExistingUnitIds,
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
  readyAt?: Date,
  scope?: ReservationPlatformUnitSyncScope
) {
  await syncReservationPlatformUnitsInternalTx(tx, reservation.id, readyAt, scope);
}
