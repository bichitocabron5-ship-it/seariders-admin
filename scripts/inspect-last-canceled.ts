// script/inspect-last-cancelled.ts
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
  });

  console.log(reservations);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());