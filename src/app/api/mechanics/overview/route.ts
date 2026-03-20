// src/app/api/mechanics/overview/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MaintenanceEntityType } from "@prisma/client";
import { calcService, type ServiceState } from "@/lib/mechanics";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Query = z.object({
  only: z.enum(["warn_due"]).optional(),
});

export async function GET(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({ only: url.searchParams.get("only") ?? undefined });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const onlyWarnDue = parsed.data.only === "warn_due";

  const [jetskis, assets] = await Promise.all([
    prisma.jetski.findMany({
      orderBy: [{ number: "asc" }],
      select: {
        id: true,
        number: true,
        plate: true,
        chassisNumber: true,
        model: true,
        year: true,
        maxPax: true,
        status: true,
        currentHours: true,
        lastServiceHours: true,
        serviceIntervalHours: true,
        serviceWarnHours: true,
        operabilityStatus: true,
      },
    }),
    prisma.asset.findMany({
      where: {
        OR: [
          { isMotorized: true },
          { type: { in: ["BOAT", "TOWBOAT", "JETCAR"] } },
        ],
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        type: true,
        name: true,
        plate: true,
        chassisNumber: true,
        model: true,
        year: true,
        maxPax: true,
        status: true,
        isMotorized: true,
        currentHours: true,
        lastServiceHours: true,
        serviceIntervalHours: true,
        serviceWarnHours: true,
        operabilityStatus: true,
      },
    }),
  ]);

  const [lastJetskiEvents, lastAssetEvents] = await Promise.all([
    prisma.maintenanceEvent.findMany({
      where: { entityType: MaintenanceEntityType.JETSKI, jetskiId: { not: null } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        jetskiId: true,
        hoursAtService: true,
        createdAt: true,
        type: true,
      },
    }),
    prisma.maintenanceEvent.findMany({
      where: { entityType: MaintenanceEntityType.ASSET, assetId: { not: null } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        assetId: true,
        hoursAtService: true,
        createdAt: true,
        type: true,
      },
    }),
  ]);

  const lastJetskiMap = new Map<
    string,
    { hoursAtService: number; createdAt: string; type: string }
  >();
  for (const e of lastJetskiEvents) {
    if (!e.jetskiId) continue;
    if (!lastJetskiMap.has(e.jetskiId)) {
      lastJetskiMap.set(e.jetskiId, {
        hoursAtService: e.hoursAtService,
        createdAt: e.createdAt.toISOString(),
        type: e.type,
      });
    }
  }

  const lastAssetMap = new Map<
    string,
    { hoursAtService: number; createdAt: string; type: string }
  >();
  for (const e of lastAssetEvents) {
    if (!e.assetId) continue;
    if (!lastAssetMap.has(e.assetId)) {
      lastAssetMap.set(e.assetId, {
        hoursAtService: e.hoursAtService,
        createdAt: e.createdAt.toISOString(),
        type: e.type,
      });
    }
  }

  const jetskiOut = jetskis.map((j) => {
    const lastEvt = lastJetskiMap.get(j.id) ?? null;
    const lastServiceHoursEffective = lastEvt?.hoursAtService ?? (j.lastServiceHours ?? null);

    const svc = calcService({
      currentHours: j.currentHours ?? null,
      lastServiceHours: lastServiceHoursEffective,
      serviceIntervalHours: Number(j.serviceIntervalHours ?? 85),
      serviceWarnHours: Number(j.serviceWarnHours ?? 70),
    });

    return {
      ...j,
      lastServiceEventAt: lastEvt?.createdAt ?? null,
      lastServiceEventType: lastEvt?.type ?? null,
      lastServiceHoursEffective,
      service: svc,
    };
  });

  const assetOut = assets.map((a) => {
    const lastEvt = lastAssetMap.get(a.id) ?? null;
    const lastServiceHoursEffective = lastEvt?.hoursAtService ?? (a.lastServiceHours ?? null);

    const svc = calcService({
      currentHours: a.currentHours ?? null,
      lastServiceHours: lastServiceHoursEffective,
      serviceIntervalHours: Number(a.serviceIntervalHours ?? 85),
      serviceWarnHours: Number(a.serviceWarnHours ?? 70),
    });

    return {
      ...a,
      lastServiceEventAt: lastEvt?.createdAt ?? null,
      lastServiceEventType: lastEvt?.type ?? null,
      lastServiceHoursEffective,
      service: svc,
    };
  });

  const filterWarnDue = <T extends { service: { state: ServiceState } }>(rows: T[]) =>
    onlyWarnDue ? rows.filter((r) => r.service.state === "WARN" || r.service.state === "DUE") : rows;

  return NextResponse.json({
    ok: true,
    only: onlyWarnDue ? "warn_due" : null,
    jetskis: filterWarnDue(jetskiOut),
    assets: filterWarnDue(assetOut),
  });
}

