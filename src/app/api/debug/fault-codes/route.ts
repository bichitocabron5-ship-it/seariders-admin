// src/app/api/debug/fault-codes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const count = await prisma.faultCodeCatalog.count();

  const rows = await prisma.faultCodeCatalog.findMany({
    take: 10,
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      brand: true,
      code: true,
      titleEs: true,
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true,
    count,
    rows,
  });
}