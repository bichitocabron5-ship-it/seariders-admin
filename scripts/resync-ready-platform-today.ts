import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncReservationPlatformUnitsTx } from "@/lib/reservation-platform";

async function main() {
  const tz = "Europe/Madrid";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "READY_FOR_PLATFORM",
      OR: [
        { scheduledTime: { gte: start, lt: end } },
        { scheduledTime: null, activityDate: { gte: start, lt: end } },
      ],
      units: {
        some: {
          status: "WAITING",
        },
      },
    },
    select: {
      id: true,
      customerName: true,
      source: true,
      readyForPlatformAt: true,
      units: {
        select: {
          id: true,
          unitIndex: true,
          status: true,
          serviceName: true,
          serviceCategory: true,
        },
        orderBy: { unitIndex: "asc" },
      },
    },
    orderBy: [{ scheduledTime: "asc" }, { createdAt: "asc" }],
  });

  const result: Array<{
    reservationId: string;
    customerName: string;
    source: string;
    before: Array<{ unitIndex: number; status: string; serviceName: string | null; serviceCategory: string | null }>;
    after: Array<{ unitIndex: number; status: string; serviceName: string | null; serviceCategory: string | null }>;
  }> = [];

  for (const reservation of reservations) {
    const readyAt = reservation.readyForPlatformAt ?? new Date();
    await prisma.$transaction(async (tx) => {
      await syncReservationPlatformUnitsTx(tx, { id: reservation.id }, readyAt);
    });

    const refreshed = await prisma.reservationUnit.findMany({
      where: { reservationId: reservation.id },
      orderBy: { unitIndex: "asc" },
      select: {
        unitIndex: true,
        status: true,
        serviceName: true,
        serviceCategory: true,
      },
    });

    result.push({
      reservationId: reservation.id,
      customerName: reservation.customerName,
      source: reservation.source,
      before: reservation.units.map((unit) => ({
        unitIndex: unit.unitIndex,
        status: unit.status,
        serviceName: unit.serviceName,
        serviceCategory: unit.serviceCategory,
      })),
      after: refreshed.map((unit) => ({
        unitIndex: unit.unitIndex,
        status: unit.status,
        serviceName: unit.serviceName,
        serviceCategory: unit.serviceCategory,
      })),
    });
  }

  console.log(JSON.stringify({ day, touched: result.length, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
