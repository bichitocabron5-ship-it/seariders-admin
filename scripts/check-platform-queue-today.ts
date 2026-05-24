import "dotenv/config";
import { prisma } from "@/lib/prisma";

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

  const units = await prisma.reservationUnit.findMany({
    where: {
      status: "READY_FOR_PLATFORM",
      assignments: {
        none: {
          status: { in: ["QUEUED", "ACTIVE"] },
          run: { status: { in: ["READY", "IN_SEA"] } },
        },
      },
      reservation: {
        status: { notIn: ["CANCELED", "COMPLETED"] },
        OR: [
          { scheduledTime: { gte: start, lt: end } },
          { scheduledTime: null, activityDate: { gte: start, lt: end } },
        ],
      },
    },
    orderBy: [{ reservation: { scheduledTime: "asc" } }, { unitIndex: "asc" }],
    select: {
      id: true,
      unitIndex: true,
      serviceName: true,
      serviceCategory: true,
      reservation: {
        select: {
          id: true,
          source: true,
          customerName: true,
          scheduledTime: true,
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        day,
        count: units.length,
        boothCount: units.filter((unit) => unit.reservation.source === "BOOTH").length,
        rows: units,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
