// src/app/api/mechanics/events/open/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MaintenanceStatus } from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "50"),
    200
  );

  const rows = await prisma.maintenanceEvent.findMany({
    where: {
      status: {
        in: [
          MaintenanceStatus.OPEN,
          MaintenanceStatus.IN_PROGRESS,
          MaintenanceStatus.EXTERNAL,
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      entityType: true,
      type: true,
      status: true,
      severity: true,
      createdAt: true,
      resolvedAt: true,
      hoursAtService: true,
      note: true,
      supplierName: true,
      externalWorkshop: true,
      costCents: true,
      laborCostCents: true,
      partsCostCents: true,
      faultCode: true,
      reopenCount: true,
      jetski: {
        select: {
          id: true,
          number: true,
          model: true,
          plate: true,
          chassisNumber: true,
          maxPax: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          plate: true,
          chassisNumber: true,
          maxPax: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
        },
      },
      _count: {
        select: {
          partUsages: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}
