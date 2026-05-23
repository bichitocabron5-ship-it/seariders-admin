import "dotenv/config";
import { ReservationSource, ReservationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type Flags = {
  reservationId: string | null;
  apply: boolean;
};

function parseFlags(): Flags {
  const args = process.argv.slice(2);
  let reservationId: string | null = null;
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--reservationId") {
      reservationId = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
    }
  }

  return { reservationId, apply };
}

async function main() {
  const { reservationId, apply } = parseFlags();

  if (!reservationId) {
    throw new Error("Uso: npx tsx scripts/restore-canceled-reservation.ts --reservationId <id> [--apply]");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      source: true,
      status: true,
      formalizedAt: true,
      readyForPlatformAt: true,
      taxiboatTripId: true,
      taxiboatAssignedAt: true,
      arrivedStoreAt: true,
      paymentCompletedAt: true,
      departureAt: true,
      arrivalAt: true,
      customerName: true,
      activityDate: true,
      scheduledTime: true,
      payments: {
        select: {
          id: true,
          amountCents: true,
          direction: true,
          isDeposit: true,
        },
      },
      units: {
        select: {
          id: true,
          status: true,
        },
      },
      contracts: {
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          driverName: true,
          signedAt: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new Error(`Reserva no existe: ${reservationId}`);
  }

  if (reservation.source !== ReservationSource.STORE && reservation.source !== ReservationSource.BOOTH) {
    throw new Error(`Solo se restauran reservas STORE/BOOTH. Source actual: ${reservation.source}`);
  }

  if (reservation.status !== ReservationStatus.CANCELED) {
    throw new Error(`La reserva no está cancelada. Status actual: ${reservation.status}`);
  }

  if (reservation.formalizedAt) {
    throw new Error("La reserva ya tiene formalizedAt. No se restaura con este script.");
  }

  if (reservation.payments.length > 0) {
    throw new Error("La reserva tiene cobros/devoluciones. No se restaura con este script.");
  }

  if (reservation.units.length > 0) {
    throw new Error("La reserva tiene unidades operativas. No se restaura con este script.");
  }

  if (
    reservation.readyForPlatformAt ||
    reservation.taxiboatTripId ||
    reservation.taxiboatAssignedAt ||
    reservation.arrivedStoreAt ||
    reservation.paymentCompletedAt ||
    reservation.departureAt ||
    reservation.arrivalAt
  ) {
    throw new Error("La reserva ya entró en flujo operativo. No se restaura con este script.");
  }

  const signedContracts = reservation.contracts.filter((contract) => contract.status === "SIGNED");
  if (signedContracts.length === 0) {
    throw new Error("La reserva no tiene contratos firmados. No coincide con el caso a reparar.");
  }

  const preview = {
    id: reservation.id,
    customerName: reservation.customerName,
    source: reservation.source,
    statusFrom: reservation.status,
    statusTo: ReservationStatus.WAITING,
    activityDate: reservation.activityDate.toISOString(),
    scheduledTime: reservation.scheduledTime?.toISOString() ?? null,
    signedContracts: signedContracts.map((contract) => ({
      id: contract.id,
      unitIndex: Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0),
      driverName: contract.driverName,
      signedAt: contract.signedAt?.toISOString() ?? null,
    })),
  };

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", preview }, null, 2));

  if (!apply) {
    console.log("Dry-run completado. Añade --apply para restaurar la reserva.");
    return;
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.WAITING,
      readyForPlatformAt: null,
      taxiboatTripId: null,
      taxiboatAssignedAt: null,
    },
  });

  console.log(`Reserva restaurada a WAITING: ${reservation.id}`);
}

main()
  .catch((error) => {
    console.error("Error restaurando reserva cancelada:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
