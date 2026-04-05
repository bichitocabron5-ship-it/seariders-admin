// scripts/delete-last-canceled.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ReservationStatus } from "@prisma/client";

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CANCELED,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 4,
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (reservations.length === 0) {
    console.log("No hay reservas canceladas para borrar.");
    return;
  }

  const ids = reservations.map((r) => r.id);
  console.log("Reservas a borrar:", reservations);

  await prisma.$transaction(async (tx) => {
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

  console.log("✅ Reservas eliminadas correctamente");
}

main()
  .catch((e) => {
    console.error("❌ Error borrando reservas:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());