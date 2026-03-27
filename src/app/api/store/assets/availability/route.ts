// src/app/api/store/assets/availability/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.rentalAsset.groupBy({
    by: ["type", "size"],
    where: {
      isActive: true,
      status: "AVAILABLE",
    },
    _count: {
      _all: true,
    },
  });

  // Normalizamos
  const result = rows.map((r) => ({
    type: r.type,
    size: r.size ?? null,
    available: r._count._all,
  }));

  return NextResponse.json({
    ok: true,
    rows: result,
  });
}