// src/app/api/platform/jetskis/available/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { platformAssignmentBlockingReason } from "@/lib/operability";

export const runtime = "nodejs";

const Query = z.object({
  runId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const includeBlocked = req.nextUrl.searchParams.get("includeBlocked") === "true";
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({ runId: url.searchParams.get("runId") ?? undefined });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const runId = parsed.data.runId;

  // Jetskis usadas por assignments abiertos (global).
  const usedByAssignments = (
    await prisma.monitorRunAssignment.findMany({
      where: {
        status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
        run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
        ...(runId ? { runId: { not: runId } } : {}),
      },
      select: { jetskiId: true },
    })
  )
    .map((r) => r.jetskiId)
    .filter((x): x is string => !!x);

  // Jetskis reservadas como moto de monitor en runs abiertos.
  const usedByMonitorRuns = (
    await prisma.monitorRun.findMany({
      where: {
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
        monitorJetskiId: { not: null },
        ...(runId ? { id: { not: runId } } : {}),
      },
      select: { monitorJetskiId: true },
    })
  )
    .map((r) => r.monitorJetskiId)
    .filter((x): x is string => !!x);

  const usedJetskiIds = Array.from(new Set([...usedByAssignments, ...usedByMonitorRuns]));

  const jetskis = await prisma.jetski.findMany({
    where: {
      ...(includeBlocked ? {} : { operabilityStatus: "OPERATIONAL" }),
    },
    orderBy: [{ number: "asc" }],
    select: {
      id: true,
      number: true,
      model: true,
      year: true,
      status: true,
      operabilityStatus: true,
      maintenanceEvents: {
        where: {
          status: {
            in: ["OPEN", "IN_PROGRESS", "EXTERNAL"],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          faultCode: true,
          note: true,
        },
      },
      incidents: {
        where: {
          isOpen: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          type: true,
          level: true,
          status: true,
          description: true,
          notes: true,
        },
      },
    },
  });

  const rows = jetskis.map((j) => {
    const blockReason = platformAssignmentBlockingReason({
      operabilityStatus: j.operabilityStatus,
      hasOpenMaintenanceEvent: Boolean(j.maintenanceEvents?.[0]),
      hasOpenIncident: Boolean(j.incidents?.[0]),
    });

    const activeMaintenanceEventId = j.maintenanceEvents?.[0]?.id ?? null;
    const activeIncidentId = j.incidents?.[0]?.id ?? null;

    return {
      ...j,
      blockReason,
      activeMaintenanceEventId,
      activeIncidentId,
    };
  });

  return NextResponse.json({
    ok: true,
    runId: runId ?? null,
    jetskis: rows,
    usedJetskiIds,
  });
}
