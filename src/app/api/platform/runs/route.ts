// src/app/api/platform/runs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { JetskiStatus, MonitorRunKind, MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";
import { AssetStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Body = z.object({
  monitorId: z.string().min(1),
  kind: z.nativeEnum(MonitorRunKind),
  monitorJetskiId: z.string().optional().nullable(),
  monitorAssetId: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ==========================
// GET -> listado tablero
//  - opcional: ?kind=JETSKI|NAUTICA
// ==========================
export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const kindParam = (url.searchParams.get("kind") ?? "").toUpperCase();
  const kind =
    kindParam && (Object.values(MonitorRunKind) as string[]).includes(kindParam)
      ? (kindParam as MonitorRunKind)
      : null;

  const runs = await prisma.monitorRun.findMany({
    where: {
      status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
      ...(kind ? { kind } : {}),
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      kind: true,
      monitorId: true,
      status: true,
      startedAt: true,
      note: true,
      monitorJetskiId: true,
      monitorAssetId: true,
      monitor: { select: { id: true, name: true, maxCapacity: true } },
      monitorJetski: { select: { id: true, number: true, model: true } },
      monitorAsset: { select: { id: true, name: true, type: true } },
      assignments: {
        where: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { startedAt: "asc" }],
        select: {
          id: true,
          reservationId: true,
          reservationUnitId: true,

          // jetski
          jetskiId: true,
          jetski: { select: { id: true, number: true } },

          // NAUTICA
          assetId: true,
          asset: { select: { id: true, name: true, type: true, model: true } },

          status: true,
          createdAt: true,
          startedAt: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,
          reservation: { select: { id: true, customerName: true } },
        },
      },
    },
  });

  const monitors = await prisma.monitor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, maxCapacity: true, isActive: true },
  });

  const normalizedRuns = runs.map((run) => ({
    ...run,
    kind: run.kind,
  }));

  return NextResponse.json({ runs: normalizedRuns, monitors });
}

// ==========================
// POST -> crear run (READY)
// ==========================
export async function POST(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { monitorId, kind, monitorJetskiId, monitorAssetId, note, activityDate } = parsed.data;

  // Validación coherente por kind
  if (kind === MonitorRunKind.JETSKI) {
    if (monitorAssetId !== null && monitorAssetId !== undefined) {
      return NextResponse.json({ error: "JETSKI no puede usar monitorAssetId" }, { status: 400 });
    }
  }
  if (kind === MonitorRunKind.NAUTICA) {
    if (monitorJetskiId !== null && monitorJetskiId !== undefined) {
      return NextResponse.json({ error: "NAUTICA no puede usar monitorJetskiId" }, { status: 400 });
    }
  }
  if (kind === MonitorRunKind.NAUTICA && (monitorAssetId === null || monitorAssetId === undefined)) {
      return NextResponse.json({ error: "NAUTICA requiere monitorAssetId" }, { status: 400 });
    }

  const businessDate = activityDate
    ? utcDateFromYmdInTz(BUSINESS_TZ, activityDate)
    : utcDateFromYmdInTz(
        BUSINESS_TZ,
        new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date())
      );

  const result = await prisma.$transaction(async (tx) => {
    const monitor = await tx.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, isActive: true },
    });
    if (!monitor || !monitor.isActive) return { error: "Monitor no existe o no está activo" };

    const existing = await tx.monitorRun.findFirst({
      where: {
        monitorId,
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
      },
      select: { id: true },
    });
    if (existing) return { error: "El monitor ya tiene salida abierta" };

    if (monitorJetskiId !== null && monitorJetskiId !== undefined) {
      const jetski = await tx.jetski.findUnique({
        where: { id: monitorJetskiId },
        select: { id: true, status: true },
      });
      if (!jetski || jetski.status !== JetskiStatus.OPERATIONAL) {
        return { error: "La moto del monitor no está disponible" };
      }

      const busyAssignment = await tx.monitorRunAssignment.findFirst({
        where: {
          jetskiId: monitorJetskiId,
          status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
          run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
        },
        select: { id: true },
      });
      if (busyAssignment) return { error: "La moto del monitor ya está ocupada en otra salida" };

      const busyRunMonitorJetski = await tx.monitorRun.findFirst({
        where: {
          monitorJetskiId,
          status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
        },
        select: { id: true },
      });
      if (busyRunMonitorJetski) return { error: "La moto del monitor ya está reservada en otra salida abierta" };
    }

        if (monitorAssetId !== null && monitorAssetId !== undefined) {
      const asset = await tx.asset.findUnique({
        where: { id: monitorAssetId },
        select: { id: true, status: true, type: true, name: true },
      });
      if (!asset || asset.status !== AssetStatus.OPERATIONAL) {
        return { error: "El recurso del monitor no está disponible" };
      }

      const busyAssignment = await tx.monitorRunAssignment.findFirst({
        where: {
          assetId: monitorAssetId,
          status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
          run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
          endedAt: null,
        },
        select: { id: true },
      });
      if (busyAssignment) {
        return { error: "El recurso del monitor ya está ocupado en otra salida" };
      }

      const busyRunMonitorAsset = await tx.monitorRun.findFirst({
        where: {
          monitorAssetId,
          status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
        },
        select: { id: true },
      });
      if (busyRunMonitorAsset) {
        return { error: "El recurso del monitor ya está reservado en otra salida abierta" };
      }
    }
    
    const run = await tx.monitorRun.create({
      data: {
        monitorId,
        kind,
        monitorJetskiId: kind === MonitorRunKind.JETSKI ? (monitorJetskiId ?? null) : null,
        monitorAssetId: kind === MonitorRunKind.NAUTICA ? (monitorAssetId ?? null) : null,
        status: MonitorRunStatus.READY,
        activityDate: businessDate,
        startedAt: new Date(),
        note: note?.trim() || null,
        createdByUserId: session.userId,
      },
      select: {
        id: true,
        kind: true,
        monitorId: true,
        monitorJetskiId: true,
        monitorAssetId: true,
        status: true,
        startedAt: true,
        monitor: { select: { id: true, name: true } },
        monitorJetski: { select: { id: true, number: true, model: true } },
        monitorAsset: { select: { id: true, name: true, type: true } },
      },
    });

    return {
      run: {
        ...run,
        kind: run.kind,
      },
    };
  });

  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

