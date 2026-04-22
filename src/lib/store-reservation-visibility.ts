import type { Prisma, ReservationStatus } from "@prisma/client";

type ReservationDayRange = {
  start: Date;
  endExclusive: Date;
};

export const STORE_TODAY_VISIBLE_STATUSES: ReservationStatus[] = [
  "WAITING",
  "READY_FOR_PLATFORM",
  "IN_SEA",
  "SCHEDULED",
];

export function buildReservationOccursInRangeWhere(
  range: ReservationDayRange
): Prisma.ReservationWhereInput {
  return {
    OR: [
      { scheduledTime: { gte: range.start, lt: range.endExclusive } },
      { scheduledTime: null, activityDate: { gte: range.start, lt: range.endExclusive } },
    ],
  };
}

export function buildStoreArrivedSourceWhere(): Prisma.ReservationWhereInput {
  return {
    OR: [
      { source: "STORE" },
      { source: "BOOTH", arrivedStoreAt: { not: null } },
    ],
  };
}

export function buildStoreTodayWhere(
  range: ReservationDayRange
): Prisma.ReservationWhereInput {
  return {
    status: { in: STORE_TODAY_VISIBLE_STATUSES },
    formalizedAt: { not: null },
    AND: [
      buildReservationOccursInRangeWhere(range),
      buildStoreArrivedSourceWhere(),
    ],
  };
}

export function buildStorePendingTodayWhere(
  range: ReservationDayRange
): Prisma.ReservationWhereInput {
  return {
    status: "WAITING",
    formalizedAt: null,
    AND: [
      buildReservationOccursInRangeWhere(range),
      buildStoreArrivedSourceWhere(),
    ],
  };
}

export function buildStoreCalendarWhere(
  range: ReservationDayRange
): Prisma.ReservationWhereInput {
  return {
    source: { in: ["STORE", "BOOTH"] },
    AND: [buildReservationOccursInRangeWhere(range)],
  };
}

export function buildStoreHistoryWhere(
  range: ReservationDayRange
): Prisma.ReservationWhereInput {
  return {
    OR: [
      { status: { in: ["COMPLETED", "CANCELED"] } },
      {
        OR: [
          { scheduledTime: { lt: range.start } },
          { scheduledTime: null, activityDate: { lt: range.start } },
        ],
      },
    ],
  };
}
