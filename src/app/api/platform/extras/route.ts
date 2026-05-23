import { NextResponse } from "next/server";

import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { prisma } from "@/lib/prisma";
import { listPlatformCatalogExtrasTx, type PlatformExtraTarget } from "@/lib/platform-extras";

export const runtime = "nodejs";

function parseTarget(req: Request): PlatformExtraTarget | undefined {
  const raw = new URL(req.url).searchParams.get("kind")?.trim().toUpperCase();
  if (raw === "JETSKI") return "JETSKI";
  if (raw === "NAUTICA" || raw === "BOAT") return "BOAT";
  return undefined;
}

export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const target = parseTarget(req);
  const extras = await prisma.$transaction((tx) => listPlatformCatalogExtrasTx(tx, target));

  return NextResponse.json({
    ok: true,
    target: target ?? null,
    extras: extras
      .filter((extra) => extra.extraMinutes === 20 || extra.extraMinutes === 40)
      .map((extra) => ({
        serviceId: extra.serviceId,
        serviceCode: extra.serviceCode,
        serviceName: extra.serviceName,
        extraMinutes: extra.extraMinutes,
        target: extra.target,
        unitPriceCents: extra.unitPriceCents,
      })),
  });
}
