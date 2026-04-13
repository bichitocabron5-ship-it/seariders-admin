// src/app/api/platform/queue/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveReservationStatusFromUnits } from "@/lib/reservation-status";
import {
  ReservationStatus,
  JetskiStatus,
  MonitorRunStatus,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { computeRequiredPlatformUnits } from "@/lib/reservation-rules";

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

    const requiredUnits = computeRequiredPlatformUnits({
      quantity: reservation.quantity,
      serviceCategory: reservation.service?.category ?? null,
      items: (reservation.items ?? []).map((item) => ({
        quantity: item.quantity ?? 0,
        isExtra: Boolean(item.isExtra),
        service: item.service ? { category: item.service.category ?? null } : null,
      })),
    });
    if (requiredUnits <= 0) continue;

    const existing = new Set((reservation.units ?? []).map((unit) => Number(unit.unitIndex)));
    const toCreate: Array<{ reservationId: string; unitIndex: number; readyForPlatformAt?: Date }> = [];

    for (let i = 1; i <= requiredUnits; i++) {
      if (!existing.has(i)) {
        toCreate.push({
          reservationId: reservation.id,
          unitIndex: i,
          ...(reservation.readyForPlatformAt ? { readyForPlatformAt: reservation.readyForPlatformAt } : {}),
        });
      }
    }

    if (toCreate.length > 0) {
      await prisma.reservationUnit.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }
  }
}

export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const kind = parseKind(req);
  const categories = parseCategories(req);
  await repairClosedQueuedAssignments();

  // 1) Units en cola
  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);
  await repairMissingReadyPlatformUnits({ start, endExclusive, kind, categories });
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
        service: categories
          ? {
              category: { in: categories as unknown as string[] },
            }
          : kind === "JETSKI"
            ? {
                category: "JETSKI",
              }
            : kind === "NAUTICA"
              ? {
                  category: { not: "JETSKI" },
                }
              : undefined,
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
    isLicense: Boolean(u.reservation.isLicense),
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
      mode: true,
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
