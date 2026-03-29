// src/app/api/platform/queue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ReservationStatus,
  JetskiStatus,
  MonitorRunStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

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

function deriveReservationStatusFromUnits(
  units: Array<{ status: ReservationUnitStatus }>
): ReservationStatus {
  if (!units.length) return ReservationStatus.WAITING;
  if (units.some((u) => u.status === ReservationUnitStatus.IN_SEA)) return ReservationStatus.IN_SEA;
  if (units.some((u) => u.status === ReservationUnitStatus.READY_FOR_PLATFORM)) return ReservationStatus.READY_FOR_PLATFORM;
  if (units.some((u) => u.status === ReservationUnitStatus.WAITING)) return ReservationStatus.WAITING;
  if (units.every((u) => u.status === ReservationUnitStatus.COMPLETED)) return ReservationStatus.COMPLETED;
  if (units.every((u) => u.status === ReservationUnitStatus.CANCELED)) return ReservationStatus.CANCELED;
  return ReservationStatus.WAITING;
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

export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const categories = parseCategories(req);
  await repairClosedQueuedAssignments();

  // 1) Units en cola
  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);
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
        ...(categories
          ? {
              service: {
                category: { in: categories as unknown as string[] },
              },
            }
          : {}),
        OR: [
          { scheduledTime: { gte: start, lt: endExclusive } },
          { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
        ],
      },
    },
    orderBy: [{ reservation: { scheduledTime: "asc" } }, { unitIndex: "asc" }],
    select: {
      id: true,
      unitIndex: true,
      status: true,
      jetskiId: true,
      readyForPlatformAt: true,
      reservation: {
        select: {
          id: true,
          customerName: true,
          activityDate: true,
          scheduledTime: true,
          isLicense: true,
          status: true,
          pax: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true } },
          quantity: true,
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
    serviceName: u.reservation.service?.name ?? null,
    category: u.reservation.service?.category ?? null,
    durationMinutes: u.reservation.option?.durationMinutes ?? null,
    pax: u.reservation.pax ?? null,
    quantity: u.reservation.quantity ?? null,
  }));

  // 2) Jetskis activos (disponibles)
  const jetskis = await prisma.jetski.findMany({
    where: { status: JetskiStatus.OPERATIONAL },
    orderBy: [{ number: "asc" }],
    select: { id: true, number: true, model: true, year: true, status: true },
  });

  // 3) Monitors
  const monitors = await prisma.monitor.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, maxCapacity: true, isActive: true },
  });

  // 4) Runs abiertos (tablero)
  const runs = await prisma.monitorRun.findMany({
    where: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
    orderBy: [{ startedAt: "desc" }],
    select: {
      id: true,
      kind: true,
      monitorId: true,
      status: true,
      startedAt: true,
      note: true,
      monitorJetskiId: true,
      monitorAssetId: true,
      monitor: { select: { id: true, name: true } },
      monitorJetski: { select: { id: true, number: true, model: true } },
      monitorAsset: { select: { id: true, name: true, type: true } },
      assignments: {
        where: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { startedAt: "asc" }],
        select: {
          id: true,
          reservationId: true,
          reservationUnitId: true,
          jetskiId: true,
          status: true,
          createdAt: true,
          expectedEndAt: true,
          startedAt: true,
          durationMinutesSnapshot: true,
          reservation: { select: { customerName: true } },
          jetski: { select: { number: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, queue, units, jetskis, runs, monitors });
}
