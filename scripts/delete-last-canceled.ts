// scripts/delete-last-canceled.ts
import "dotenv/config";
import { ReservationSource, ReservationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const TARGET_SOURCES = [ReservationSource.STORE, ReservationSource.BOOTH] as const;

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CANCELED,
      source: { in: [...TARGET_SOURCES] },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      source: true,
      createdAt: true,
    },
  });

  if (reservations.length === 0) {
    console.log("No hay reservas canceladas de STORE/BOOTH para borrar.");
    return;
  }

  const ids = reservations.map((reservation) => reservation.id);
  console.log(`Total canceladas STORE/BOOTH a borrar: ${reservations.length}`);
  console.log("Reservas a borrar:", reservations);

  await prisma.$transaction(async (tx) => {
    await (tx as any).giftVoucher?.updateMany?.({
      where: { redeemedReservationId: { in: ids } },
      data: { redeemedReservationId: null },
    });

    await (tx as any).passConsume?.updateMany?.({
      where: { reservationId: { in: ids } },
      data: { reservationId: null },
    });

    await (tx as any).reservationItem?.updateMany?.({
      where: { splitReservationId: { in: ids } },
      data: { splitReservationId: null },
    });

    await (tx as any).reservationItem?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await (tx as any).payment?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await (tx as any).reservationContract?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await (tx as any).contract?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await (tx as any).fulfillmentTask?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await (tx as any).reservationUnit?.deleteMany?.({
      where: { reservationId: { in: ids } },
    });

    await tx.reservation.deleteMany({
      where: { id: { in: ids } },
    });
  });

  console.log("Reservas canceladas de STORE/BOOTH eliminadas correctamente.");
}

main()
  .catch((error) => {
    console.error("Error borrando reservas:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
