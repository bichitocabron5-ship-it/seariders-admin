// src/app/api/platform/board/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";
import { MonitorRunStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { resolveReservationUnitActivity } from "@/lib/reservation-unit-activity";

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
          reservationUnitId: true,
          reservationUnit: {
            select: {
              reservationItemId: true,
              serviceId: true,
              optionId: true,
              serviceName: true,
              serviceCategory: true,
              durationMinutesSnapshot: true,
              quantitySnapshot: true,
              paxSnapshot: true,
            },
          },
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
              quantity: true,
              pax: true,
              service: { select: { id: true, name: true, category: true } },
              option: { select: { id: true, durationMinutes: true } },
            },
          },
        },
      },
    },
  });

  const normalizedRuns = runs.map((run) => ({
    ...run,
    assignments: run.assignments.map((assignment) => {
      const activity = resolveReservationUnitActivity({
        unit: assignment.reservationUnit,
        legacyReservation: assignment.reservation,
      });

      return {
        ...assignment,
        activity,
        reservation: {
          ...assignment.reservation,
          service: {
            id: activity.serviceId,
            name: activity.serviceName,
            category: activity.serviceCategory,
          },
          option: {
            id: activity.optionId,
            durationMinutes: activity.durationMinutes,
          },
        },
      };
    }),
  }));

  return NextResponse.json({ ok: true, activityDate, runs: normalizedRuns });
}
