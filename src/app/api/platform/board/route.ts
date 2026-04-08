// src/app/api/platform/board/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";
import { MonitorRunStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Q = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Q.safeParse({ date: url.searchParams.get("date") });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const activityDate = utcDateFromYmdInTz(BUSINESS_TZ, parsed.data.date);

  const runs = await prisma.monitorRun.findMany({
    where: {
      activityDate,
      status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
    },
    orderBy: [{ startedAt: "asc" }],
    select: {
      id: true,
      kind: true,
      mode: true,
      status: true,
      startedAt: true,
      endedAt: true,
      note: true,
      monitorJetskiId: true,
      monitorAssetId: true,
      monitor: { select: { id: true, name: true, maxCapacity: true } },
      monitorJetski: { select: { id: true, number: true, model: true } },
      monitorAsset: { select: { id: true, name: true, type: true } },
      assignments: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { startedAt: "asc" }],
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true,
          expectedEndAt: true,
          endedAt: true,
          durationMinutesSnapshot: true,
          reservationId: true,
          jetskiId: true,
          assetId: true,
          jetski: { select: { id: true, number: true, status: true } },
          asset: { select: { id: true, name: true, type: true, status: true } },
          reservation: {
            select: {
              id: true,
              status: true,
              customerName: true,
              scheduledTime: true,
              // si quieres, añade service/option o items
              service: { select: { name: true, category: true } },
              option: { select: { durationMinutes: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, activityDate, runs });
}
