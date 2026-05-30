// src/app/api/platform/queue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";
import {
  ReservationStatus,
  MonitorRunStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import {
  getOperationalBlockLabel,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import { syncReservationPlatformUnitsTx } from "@/lib/reservation-platform";

export const runtime = "nodejs";

function parseCategories(req: Request): string[] | null {
  const url = new URL(req.url);
  const raw = url.searchParams.get("categories");
  if (!raw) return null;
  const cats = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return cats.length ? cats : null;
}

function parseKind(req: Request): "JETSKI" | "NAUTICA" | null {
  const url = new URL(req.url);
  const raw = url.searchParams.get("kind")?.trim().toUpperCase();
  if (raw === "JETSKI" || raw === "NAUTICA") return raw;
  return null;
}

const PLATFORM_QUEUE_REPAIR_INTERVAL_MS = 30_000;
const lastPlatformQueueRepairAtByScope = new Map<string, number>();

async function repairPlatformQueueIfDue(params: {
  start: Date;
  endExclusive: Date;
  kind: "JETSKI" | "NAUTICA" | null;
  categories: string[] | null;
}) {
  const now = Date.now();
  const scope = `${params.kind ?? "ALL"}:${params.categories?.join(",") ?? "ALL"}`;
  const lastRepairAt = lastPlatformQueueRepairAtByScope.get(scope) ?? 0;
  if (now - lastRepairAt < PLATFORM_QUEUE_REPAIR_INTERVAL_MS) return;

  lastPlatformQueueRepairAtByScope.set(scope, now);
  await repairClosedQueuedAssignments();
  await repairMissingReadyPlatformUnits(params);
}

async function repairClosedQueuedAssignments() {
  const staleAssignments = await prisma.monitorRunAssignment.findMany({
    where: {
      status: RunAssignmentStatus.QUEUED,
      run: { status: MonitorRunStatus.CLOSED },
    },
    select: {
      id: true,
      jetskiId: true,
      reservationUnitId: true,
      reservationId: true,
    },
  });

  for (const assignment of staleAssignments) {
    await prisma.$transaction(async (tx) => {
      await tx.monitorRunAssignment.delete({ where: { id: assignment.id } });

      if (assignment.reservationUnitId) {
        const unit = await tx.reservationUnit.findUnique({
          where: { id: assignment.reservationUnitId },
          select: { id: true, jetskiId: true, status: true },
        });

        if (unit && unit.status === ReservationUnitStatus.READY_FOR_PLATFORM) {
          await tx.reservationUnit.update({
            where: { id: unit.id },
            data: {
              jetskiId:
                assignment.jetskiId && unit.jetskiId === assignment.jetskiId
                  ? null
                  : unit.jetskiId,
            },
          });
        }
      }

      const units = await tx.reservationUnit.findMany({
        where: { reservationId: assignment.reservationId },
        select: { status: true },
      });

      await tx.reservation.update({
        where: { id: assignment.reservationId },
        data: { status: deriveReservationStatusFromUnits(units) },
      });
    });
  }
}

async function repairMissingReadyPlatformUnits(params: {
  start: Date;
  endExclusive: Date;
  kind: "JETSKI" | "NAUTICA" | null;
  categories: string[] | null;
}) {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.READY_FOR_PLATFORM,
      OR: [
        { scheduledTime: { gte: params.start, lt: params.endExclusive } },
        { scheduledTime: null, activityDate: { gte: params.start, lt: params.endExclusive } },
      ],
      service: params.categories
        ? { category: { in: params.categories } }
        : params.kind === "JETSKI"
          ? { category: "JETSKI" }
          : params.kind === "NAUTICA"
            ? { category: { not: "JETSKI" } }
            : undefined,
    },
    select: {
      id: true,
      quantity: true,
      readyForPlatformAt: true,
      isPackParent: true,
      parentReservationId: true,
      service: { select: { category: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true } },
        },
      },
      units: {
        select: { unitIndex: true },
      },
    },
  });

  for (const reservation of reservations) {
    if (reservation.isPackParent && !reservation.parentReservationId) continue;
    await prisma.$transaction(async (tx) => {
      await syncReservationPlatformUnitsTx(tx, { id: reservation.id }, reservation.readyForPlatformAt ?? undefined);
    });
  }
}

export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const kind = parseKind(req);
  const categories = parseCategories(req);
  // 1) Units en cola
  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);
  await repairPlatformQueueIfDue({ start, endExclusive, kind, categories });
  const units = await prisma.reservationUnit.findMany({
    where: {
      status: ReservationUnitStatus.READY_FOR_PLATFORM,
      // ✅ fuera de cola si ya está asignada (QUEUED/ACTIVE)
      assignments: {
        none: {
          status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
          run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
        },
      },
      reservation: {
        status: { notIn: [ReservationStatus.CANCELED, ReservationStatus.COMPLETED] },
        OR: [
          { scheduledTime: { gte: start, lt: endExclusive } },
          { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
        ],
      },
      ...(categories
        ? {
            serviceCategory: { in: categories as unknown as string[] },
          }
        : kind === "JETSKI"
          ? { serviceCategory: "JETSKI" }
          : kind === "NAUTICA"
            ? { serviceCategory: { not: "JETSKI" } }
            : {}),
    },
    orderBy: [{ reservation: { scheduledTime: "asc" } }, { unitIndex: "asc" }],
    select: {
      id: true,
      unitIndex: true,
      status: true,
      jetskiId: true,
      readyForPlatformAt: true,
      serviceId: true,
      optionId: true,
      serviceCategory: true,
      serviceName: true,
      durationMinutesSnapshot: true,
      quantitySnapshot: true,
      paxSnapshot: true,
      reservation: {
        select: {
          id: true,
          customerName: true,
          activityDate: true,
          scheduledTime: true,
          isLicense: true,
          status: true,
          parentReservationId: true,
        },
      },
    },
  });

  const queue = units.map((u) => ({
    reservationId: u.reservation.id,
    reservationUnitId: u.id,
    queueEnteredAt: u.readyForPlatformAt,
    customerName: u.reservation.customerName,
    serviceName: u.serviceName ?? null,
    category: u.serviceCategory ?? null,
    durationMinutes: getOperationalDurationMinutes({
      category: u.serviceCategory ?? null,
      durationMinutes: u.durationMinutesSnapshot ?? null,
      quantity: u.quantitySnapshot ?? null,
    }),
    pax: u.paxSnapshot ?? null,
    quantity: u.quantitySnapshot ?? null,
    isLicense: Boolean(u.reservation.isLicense),
    label: getOperationalBlockLabel({
      serviceName: u.serviceName ?? null,
      quantity: u.quantitySnapshot ?? null,
      pax: u.paxSnapshot ?? null,
      durationMinutes: u.durationMinutesSnapshot ?? null,
      category: u.serviceCategory ?? null,
    }),
  }));

  return NextResponse.json({ ok: true, queue });
}
