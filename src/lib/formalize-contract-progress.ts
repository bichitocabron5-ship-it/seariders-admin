import type { Prisma } from "@prisma/client";

import { buildReservationContractProgressForTargets } from "@/lib/contracts/reservation-contract-progress";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";

export async function readReservationContractProgressTx(
  tx: Prisma.TransactionClient,
  reservationId: string
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      quantity: true,
      isLicense: true,
      serviceId: true,
      optionId: true,
      pax: true,
      totalPriceCents: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          totalPriceCents: true,
          isExtra: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
      contracts: {
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          reservationItemId: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!reservation) throw new Error("Reserva no existe");

  const requirements = buildReservationContractRequirements({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    serviceId: reservation.serviceId,
    optionId: reservation.optionId,
    serviceName: reservation.service?.name ?? null,
    durationMinutes: reservation.option?.durationMinutes ?? null,
    pax: reservation.pax,
    totalPriceCents: reservation.totalPriceCents,
    items: reservation.items ?? [],
  });
  const targets = reservationContractRequirementsToSyncTargets(requirements);
  const progress = buildReservationContractProgressForTargets(
    reservation.contracts ?? [],
    targets
  );

  return {
    requiredUnits: progress.requiredUnits,
    readyCount: progress.readyCount,
  };
}
