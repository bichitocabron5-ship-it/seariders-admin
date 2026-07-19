// src/app/api/platform/jetskis/available/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
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
      currentHours: true,
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
  });
}
