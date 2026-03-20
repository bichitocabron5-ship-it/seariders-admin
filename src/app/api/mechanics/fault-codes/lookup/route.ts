// src/app/api/mechanics/fault-codes/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q")?.trim() ?? "").toUpperCase();
  const brand = req.nextUrl.searchParams.get("brand")?.trim() ?? "SEA_DOO";
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 12;

  const rows = await prisma.faultCodeCatalog.findMany({
    where: {
      isActive: true,
      ...(brand ? { brand } : {}),
      ...(q
        ? {
            OR: [
              { code: { equals: q, mode: "insensitive" } },
              { code: { startsWith: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { titleEs: { contains: q, mode: "insensitive" } },
              { descriptionEs: { contains: q, mode: "insensitive" } },
              { system: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ code: "asc" }],
    take: limit,
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
