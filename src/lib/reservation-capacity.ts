import type { Prisma, ReservationSource, ReservationStatus } from "@prisma/client";

export const NON_CAPACITY_SERVICE_CATEGORIES = ["EXTRA", "PACK"] as const;

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

export function buildCapacityBlockingReservationWhere(args?: {
  requireScheduledTime?: boolean;
}): Prisma.ReservationWhereInput {
  const requireScheduledTime = args?.requireScheduledTime ?? true;

  return {
    source: { in: CAPACITY_BLOCKING_RESERVATION_SOURCES },
    status: { in: CAPACITY_BLOCKING_RESERVATION_STATUSES },
    ...(requireScheduledTime ? { scheduledTime: { not: null } } : {}),
  };
}

export type ReservationCapacityItemLike = {
  id?: string | null;
  quantity?: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
  category?: string | null;
  durationMinutes?: number | null;
  service?: { category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

export type ReservationCapacityReservationLike = {
  id?: string | null;
  scheduledTime?: Date | string | null;
  quantity?: number | null;
  category?: string | null;
  durationMinutes?: number | null;
  service?: { category?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  items?: ReservationCapacityItemLike[] | null;
};

export type ReservationCapacityUsage = {
  reservationId: string | null;
  reservationItemId: string | null;
  scheduledTime: Date | null;
  category: string;
  durationMinutes: number;
  quantity: number;
  source: "ITEM" | "LEGACY";
};

export function normalizeCapacityCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

export function isCapacityCategory(category: string | null | undefined) {
  const normalized = normalizeCapacityCategory(category);
  return Boolean(normalized) && !NON_CAPACITY_SERVICE_CATEGORIES.includes(
    normalized as (typeof NON_CAPACITY_SERVICE_CATEGORIES)[number]
  );
}

function positiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.max(1, Math.trunc(fallback));
  return Math.max(1, Math.trunc(n));
}

function normalizeScheduledTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getReservationItemCapacityCategory(item: ReservationCapacityItemLike) {
  return normalizeCapacityCategory(item.category ?? item.service?.category ?? null);
}

export function getReservationItemCapacityDurationMinutes(
  item: ReservationCapacityItemLike,
  defaultDurationMinutes: number
) {
  return positiveInt(
    item.durationMinutes ?? item.option?.durationMinutes ?? null,
    defaultDurationMinutes
  );
}

export function buildReservationCapacityUsages(
  reservation: ReservationCapacityReservationLike,
  options: { defaultDurationMinutes?: number } = {}
): ReservationCapacityUsage[] {
  const defaultDurationMinutes = positiveInt(options.defaultDurationMinutes ?? 30, 30);
  const reservationId = reservation.id ?? null;
  const scheduledTime = normalizeScheduledTime(reservation.scheduledTime);
  const items = reservation.items ?? [];
  const capacityBearingItems = items
    .filter((item) => !item.isExtra && !item.isPackParent)
    .map((item) => ({
      item,
      category: getReservationItemCapacityCategory(item),
    }))
    .filter(({ category }) => isCapacityCategory(category));

  if (capacityBearingItems.length > 0) {
    return capacityBearingItems.map(({ item, category }): ReservationCapacityUsage => ({
      reservationId,
      reservationItemId: item.id ?? null,
      scheduledTime,
      category,
      durationMinutes: getReservationItemCapacityDurationMinutes(item, defaultDurationMinutes),
      quantity: positiveInt(item.quantity ?? null, 1),
      source: "ITEM",
    }));
  }

  const category = normalizeCapacityCategory(
    reservation.category ?? reservation.service?.category ?? null
  );
  if (!isCapacityCategory(category)) return [];

  return [
    {
      reservationId,
      reservationItemId: null,
      scheduledTime,
      category,
      durationMinutes: positiveInt(
        reservation.durationMinutes ?? reservation.option?.durationMinutes ?? null,
        defaultDurationMinutes
      ),
      quantity: positiveInt(reservation.quantity ?? null, 1),
      source: "LEGACY",
    },
  ];
}

export function buildReservationsCapacityUsages(
  reservations: readonly ReservationCapacityReservationLike[],
  options: { defaultDurationMinutes?: number } = {}
) {
  return reservations.flatMap((reservation) =>
    buildReservationCapacityUsages(reservation, options)
  );
}
