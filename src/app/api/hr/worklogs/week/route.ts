// src/app/api/hr/worklogs/week/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkArea, WorkLogStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireHrOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (["ADMIN", "HR"].includes(session.role as string)) return session;
  return null;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function mondayOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 domingo ... 1 lunes
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const Query = z.object({
  weekStart: z.string().optional(), // YYYY-MM-DD
  employeeId: z.string().optional(),
  area: z.nativeEnum(WorkArea).optional(),
  status: z.nativeEnum(WorkLogStatus).optional(),
});

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    weekStart: url.searchParams.get("weekStart") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    area: (url.searchParams.get("area") ?? undefined) as WorkArea | undefined,
    status: (url.searchParams.get("status") ?? undefined) as WorkLogStatus | undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const baseDate = parsed.data.weekStart
    ? new Date(`${parsed.data.weekStart}T00:00:00`)
    : new Date();

  const weekStart = mondayOfWeek(baseDate);
  const weekEnd = endOfDay(addDays(weekStart, 6));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      index: i,
      date: d.toISOString(),
      ymd: ymd(d),
    };
  });

  const rows = await prisma.workLog.findMany({
    where: {
      workDate: {
        gte: weekStart,
        lte: weekEnd,
      },
      ...(parsed.data.employeeId ? { employeeId: parsed.data.employeeId } : {}),
      ...(parsed.data.area ? { area: parsed.data.area } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      employeeId: true,
      workDate: true,
      checkInAt: true,
      checkOutAt: true,
      breakMinutes: true,
      workedMinutes: true,
      area: true,
      status: true,
      note: true,
      employee: {
        select: {
          id: true,
          code: true,
          fullName: true,
          kind: true,
          jobTitle: true,
          isActive: true,
        },
      },
    },
  });

  const employeeMap = new Map<
    string,
    {
      employee: {
        id: string;
        code: string | null;
        fullName: string;
        kind: string;
        jobTitle: string | null;
        isActive: boolean;
      };
      totalMinutes: number;
      totalLogs: number;
      perDay: Record<
        string,
        {
          workedMinutes: number;
          logs: number;
          openLogs: number;
          approvedLogs: number;
          statuses: string[];
          areas: string[];
        }
      >;
    }
  >();

  for (const row of rows) {
    const key = row.employeeId;
    const dayKey = ymd(new Date(row.workDate));
    const worked = Number(row.workedMinutes ?? 0);

    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        employee: row.employee,
        totalMinutes: 0,
        totalLogs: 0,
        perDay: {},
      });
    }

    const acc = employeeMap.get(key)!;
    if (!acc.perDay[dayKey]) {
      acc.perDay[dayKey] = {
        workedMinutes: 0,
        logs: 0,
        openLogs: 0,
        approvedLogs: 0,
        statuses: [],
        areas: [],
      };
    }

    acc.totalMinutes += worked;
    acc.totalLogs += 1;

    acc.perDay[dayKey].workedMinutes += worked;
    acc.perDay[dayKey].logs += 1;
    if (row.status === "OPEN") acc.perDay[dayKey].openLogs += 1;
    if (row.status === "APPROVED") acc.perDay[dayKey].approvedLogs += 1;
    if (!acc.perDay[dayKey].statuses.includes(row.status)) {
      acc.perDay[dayKey].statuses.push(row.status);
    }
    if (!acc.perDay[dayKey].areas.includes(row.area)) {
      acc.perDay[dayKey].areas.push(row.area);
    }
  }

  const employees = Array.from(employeeMap.values())
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName, "es"))
    .map((x) => ({
      employee: x.employee,
      totalMinutes: x.totalMinutes,
      totalLogs: x.totalLogs,
      perDay: days.map((d) => ({
        ymd: d.ymd,
        date: d.date,
        workedMinutes: x.perDay[d.ymd]?.workedMinutes ?? 0,
        logs: x.perDay[d.ymd]?.logs ?? 0,
        openLogs: x.perDay[d.ymd]?.openLogs ?? 0,
        approvedLogs: x.perDay[d.ymd]?.approvedLogs ?? 0,
        statuses: x.perDay[d.ymd]?.statuses ?? [],
        areas: x.perDay[d.ymd]?.areas ?? [],
      })),
    }));

  const totalsByDay = days.map((d) => {
    const dayRows = rows.filter((r) => ymd(new Date(r.workDate)) === d.ymd);
    return {
      ymd: d.ymd,
      date: d.date,
      totalMinutes: dayRows.reduce((acc, r) => acc + Number(r.workedMinutes ?? 0), 0),
      totalLogs: dayRows.length,
      openLogs: dayRows.filter((r) => r.status === "OPEN").length,
      approvedLogs: dayRows.filter((r) => r.status === "APPROVED").length,
    };
  });

  return NextResponse.json({
    ok: true,
    week: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      days,
    },
    filters: {
      employeeId: parsed.data.employeeId ?? null,
      area: parsed.data.area ?? null,
      status: parsed.data.status ?? null,
    },
    employees,
    totals: {
      weekMinutes: employees.reduce((acc, e) => acc + e.totalMinutes, 0),
      weekLogs: employees.reduce((acc, e) => acc + e.totalLogs, 0),
      byDay: totalsByDay,
    },
  });
}