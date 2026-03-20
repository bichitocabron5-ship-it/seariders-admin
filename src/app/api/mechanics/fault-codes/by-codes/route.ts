// src/app/api/mechanics/fault-codes/by-codes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rawCodes = req.nextUrl.searchParams.get("codes")?.trim() ?? "";
  const brand = req.nextUrl.searchParams.get("brand")?.trim() ?? "SEA_DOO";

  const codes = rawCodes
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (codes.length === 0) {
    return NextResponse.json({ ok: true, rows: [] });
  }

  const rows = await prisma.faultCodeCatalog.findMany({
    where: {
      isActive: true,
      ...(brand ? { brand } : {}),
      code: {
        in: codes,
      },
    },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      brand: true,
      code: true,
      system: true,
      titleEs: true,
      descriptionEs: true,
      likelyCausesEs: true,
      recommendedActionEs: true,
      severityHint: true,
      verificationStatus: true,
      source: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}