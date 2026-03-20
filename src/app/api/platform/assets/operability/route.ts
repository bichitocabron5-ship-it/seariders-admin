// src/app/api/platform/assets/operability/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requirePlatformOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const jetskis = await prisma.jetski.groupBy({
    by: ["operabilityStatus"],
    _count: true,
  });

  const assets = await prisma.asset.groupBy({
    by: ["operabilityStatus"],
    _count: true,
  });

  return NextResponse.json({
    jetskis,
    assets,
  });
}
