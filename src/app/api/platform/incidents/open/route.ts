// src/app/api/platform/incidents/open/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IncidentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requirePlatformOrAdmin({ allowMechanic: true });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.incident.findMany({
    where: {
      isOpen: true,
      status: {
        in: [IncidentStatus.OPEN, IncidentStatus.LINKED],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      entityType: true,
      type: true,
      level: true,
      status: true,
      description: true,
      affectsOperability: true,
      operabilityStatus: true,
      retainDeposit: true,
      retainDepositCents: true,
      maintenanceEventId: true,
      createdAt: true,
      jetski: {
        select: {
          id: true,
          number: true,
          model: true,
          plate: true,
          operabilityStatus: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          operabilityStatus: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}
