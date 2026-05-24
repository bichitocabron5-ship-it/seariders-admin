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

  const rows = await prisma.reservation.findMany({
    where: {
      status: "READY_FOR_PLATFORM",
      OR: [
        { scheduledTime: { gte: start, lt: end } },
        { scheduledTime: null, activityDate: { gte: start, lt: end } },
      ],
    },
    orderBy: [{ scheduledTime: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      source: true,
      customerName: true,
      activityDate: true,
      scheduledTime: true,
      formalizedAt: true,
      readyForPlatformAt: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      quantity: true,
      pax: true,
      isPackParent: true,
      parentReservationId: true,
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          quantity: true,
          pax: true,
          isExtra: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
      units: {
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          status: true,
          readyForPlatformAt: true,
          serviceName: true,
          serviceCategory: true,
          durationMinutesSnapshot: true,
          quantitySnapshot: true,
          paxSnapshot: true,
        },
      },
      monitorRunAssignments: {
        where: { status: { in: ["QUEUED", "ACTIVE"] } },
        select: {
          id: true,
          reservationUnitId: true,
          status: true,
          run: { select: { id: true, status: true } },
        },
      },
    },
  });

  console.log(JSON.stringify({ day, count: rows.length, rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
