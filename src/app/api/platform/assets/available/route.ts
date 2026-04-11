// src/app/api/platform/assets/available/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AssetType, MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { platformAssignmentBlockingReason } from "@/lib/operability";

export const runtime = "nodejs";

const Query = z.object({
  runId: z.string().optional(),
  // Opcional: filtrar por tipo (BOAT, JETCAR, etc.)
  type: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const includeBlocked = req.nextUrl.searchParams.get("includeBlocked") === "true";
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    runId: url.searchParams.get("runId") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { runId } = parsed.data;
  const typeRaw = (parsed.data.type ?? "").trim();

  // Validar type si viene
  const type =
    typeRaw && (Object.values(AssetType) as string[]).includes(typeRaw)
      ? (typeRaw as AssetType)
      : null;

  // Assets usados por assignments abiertos (global), excluyendo el propio run si viene runId.
  const usedByAssignments = (
    await prisma.monitorRunAssignment.findMany({
      where: {
        assetId: { not: null },
        status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
        run: { status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
        ...(runId ? { runId: { not: runId } } : {}),
      },
      select: { assetId: true },
    })
  )
    .map((r) => r.assetId)
    .filter((x): x is string => !!x);

  // Assets reservados como “asset fijo del monitor” en runs abiertos.
  const usedByMonitorRuns = (
    await prisma.monitorRun.findMany({
      where: {
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
        monitorAssetId: { not: null },
        ...(runId ? { id: { not: runId } } : {}),
      },
      select: { monitorAssetId: true },
    })
  )
    .map((r) => r.monitorAssetId)
    .filter((x): x is string => !!x);

  const usedAssetIds = Array.from(new Set([...usedByAssignments, ...usedByMonitorRuns]));

  const assets = await prisma.asset.findMany({
    where: {
      platformUsage: { not: "HIDDEN" },
      ...(includeBlocked ? {} : { operabilityStatus: "OPERATIONAL" }),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      platformUsage: true,
      model: true,
      year: true,
      plate: true,
      status: true,
      operabilityStatus: true,
      note: true,
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

  const rows = assets.map((a) => {
    const blockReason = platformAssignmentBlockingReason({
      operabilityStatus: a.operabilityStatus,
      hasOpenMaintenanceEvent: Boolean(a.maintenanceEvents?.[0]),
      hasOpenIncident: Boolean(a.incidents?.[0]),
    });

    const activeMaintenanceEventId = a.maintenanceEvents?.[0]?.id ?? null;
    const activeIncidentId = a.incidents?.[0]?.id ?? null;

    return {
      ...a,
      blockReason,
      activeMaintenanceEventId,
      activeIncidentId,
    };
  });
  
  return NextResponse.json({
    ok: true,
    runId: runId ?? null,
    type,
    assets: rows,
    usedAssetIds,
  });
}
