// scripts/inspect-last-canceled.ts
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
      activityDate: true,
      customerName: true,
    },
  });

  console.log(`Total canceladas STORE/BOOTH: ${reservations.length}`);
  console.log(reservations);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
