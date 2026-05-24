import type { Prisma, ReservationSource, ReservationStatus } from "@prisma/client";

export const CAPACITY_BLOCKING_RESERVATION_SOURCES: ReservationSource[] = [
  "STORE",
  "BOOTH",
  "WEB",
];

export const CAPACITY_BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  "SCHEDULED",
  "WAITING",
  "READY_FOR_PLATFORM",
  "IN_SEA",
];

export function doesReservationSourceBlockCapacity(source: ReservationSource | null | undefined) {
  return source != null && CAPACITY_BLOCKING_RESERVATION_SOURCES.includes(source);
}

export function doesReservationStatusBlockCapacity(status: ReservationStatus | null | undefined) {
  return status != null && CAPACITY_BLOCKING_RESERVATION_STATUSES.includes(status);
}

export function doesReservationBlockCapacity(args: {
  source: ReservationSource | null | undefined;
  status: ReservationStatus | null | undefined;
  scheduledTime: Date | null | undefined;
}) {
  return (
    doesReservationSourceBlockCapacity(args.source) &&
    doesReservationStatusBlockCapacity(args.status) &&
    Boolean(args.scheduledTime)
  );
}

export function buildCapacityBlockingReservationWhere(): Prisma.ReservationWhereInput {
  return {
    source: { in: CAPACITY_BLOCKING_RESERVATION_SOURCES },
    status: { in: CAPACITY_BLOCKING_RESERVATION_STATUSES },
    scheduledTime: { not: null },
  };
}
