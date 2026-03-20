// src/app/api/platform/runs/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MonitorRunStatus } from "@prisma/client";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Body = z.object({
  monitorId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  // opcional: si quieres forzar día operativo desde UI:
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { monitorId, note, activityDate } = parsed.data;

  const businessDate = activityDate
    ? utcDateFromYmdInTz(BUSINESS_TZ, activityDate)
    : utcDateFromYmdInTz(BUSINESS_TZ, new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date()));

  try {
    const out = await prisma.$transaction(async (tx) => {
      const monitor = await tx.monitor.findUnique({
        where: { id: monitorId },
        select: { id: true, isActive: true, maxCapacity: true },
      });
      if (!monitor || !monitor.isActive) throw new Error("Monitor no existe o no está activo");

      const existing = await tx.monitorRun.findFirst({
        where: { monitorId, status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] } },
        select: { id: true, status: true },
      });

      if (existing) {
        return { ok: false, reason: "MONITOR_HAS_OPEN_RUN", runId: existing.id, status: existing.status };
      }

      const run = await tx.monitorRun.create({
        data: {
          monitorId,
          status: MonitorRunStatus.READY,
          activityDate: businessDate,
          note: note?.trim() ? note.trim() : null,
          createdByUserId: session.userId,
        },
        select: { id: true, monitorId: true, status: true, startedAt: true, activityDate: true },
      });

      return { ok: true, run };
    });

    return NextResponse.json(out, { status: out.ok ? 200 : 409 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
