import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

const Query = z.object({
  q: z.string().optional(),
  employeeId: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(100),
});

function minutesBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return Math.round(diff / 60000);
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) return new NextResponse("Query invalida", { status: 400 });

  const { q, employeeId, status, dateFrom, dateTo, take } = parsed.data;

  const where: Record<string, unknown> = {
    isInternalUsage: true,
  };

  if (employeeId) where.employeeId = employeeId;
  if (status && status !== "ALL") where.status = status;

  if (dateFrom || dateTo) {
    where.activityDate = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (q?.trim()) {
    const query = q.trim();
    where.OR = [
      { customerName: { contains: query, mode: "insensitive" } },
      { manualEntryNote: { contains: query, mode: "insensitive" } },
      { employee: { fullName: { contains: query, mode: "insensitive" } } },
      { service: { name: { contains: query, mode: "insensitive" } } },
    ];
  }

  const rowsDb = await prisma.reservation.findMany({
    where,
    orderBy: [{ activityDate: "desc" }, { scheduledTime: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      status: true,
      activityDate: true,
      scheduledTime: true,
      quantity: true,
      pax: true,
      totalPriceCents: true,
      depositCents: true,
      customerName: true,
      manualEntryNote: true,
      readyForPlatformAt: true,
      departureAt: true,
      arrivalAt: true,
      createdAt: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          code: true,
          kind: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
      option: {
        select: {
          id: true,
          durationMinutes: true,
        },
      },
      monitorRunAssignments: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          status: true,
          startedAt: true,
          expectedEndAt: true,
          endedAt: true,
          jetski: { select: { id: true, number: true } },
          asset: { select: { id: true, name: true } },
          run: {
            select: {
              id: true,
              kind: true,
              mode: true,
              startedAt: true,
            },
          },
        },
      },
    },
  });

  const rows = rowsDb.map((row) => {
    const assignmentMinutes = row.monitorRunAssignments.reduce((acc, assignment) => {
      const effectiveEnd = assignment.endedAt ?? assignment.expectedEndAt ?? null;
      return acc + Number(minutesBetween(assignment.startedAt, effectiveEnd) ?? 0);
    }, 0);

    const resourceLabels = row.monitorRunAssignments
      .map((assignment) => assignment.jetski?.number ?? assignment.asset?.name ?? null)
      .filter((value): value is string => Boolean(value));

    return {
      id: row.id,
      status: row.status,
      activityDate: row.activityDate,
      scheduledTime: row.scheduledTime,
      quantity: row.quantity,
      pax: row.pax,
      totalPriceCents: row.totalPriceCents,
      depositCents: row.depositCents,
      customerName: row.customerName,
      note: row.manualEntryNote,
      readyForPlatformAt: row.readyForPlatformAt,
      departureAt: row.departureAt,
      arrivalAt: row.arrivalAt,
      createdAt: row.createdAt,
      employee: row.employee,
      service: row.service,
      option: row.option,
      assignmentCount: row.monitorRunAssignments.length,
      assignmentMinutes: assignmentMinutes || null,
      resources: [...new Set(resourceLabels)],
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc.linkedEmployees += row.employee ? 1 : 0;
      acc.ready += row.status === "READY_FOR_PLATFORM" ? 1 : 0;
      acc.inSea += row.status === "IN_SEA" ? 1 : 0;
      acc.completed += row.status === "COMPLETED" ? 1 : 0;
      acc.totalMinutes += Number(row.assignmentMinutes ?? 0);
      return acc;
    },
    { total: 0, linkedEmployees: 0, ready: 0, inSea: 0, completed: 0, totalMinutes: 0 },
  );

  return NextResponse.json({ ok: true, rows, summary });
}
