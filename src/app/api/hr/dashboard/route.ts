// src/app/api/hr/dashboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { WorkLogStatus, PayrollStatus } from "@prisma/client";

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

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET() {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const from = startOfDay();
  const to = endOfDay();

  const [
    totalActiveEmployees,
    activeEmployees,
    activeRates,
    todayLogs,
    pendingPayrollCount,
    pendingPayrollAmountAgg,
    activeByKind,
    pendingPayrollAlerts,
  ] = await Promise.all([
    prisma.employee.count({
      where: { isActive: true },
    }),

    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        code: true,
        kind: true,
        userId: true,
        internshipHoursTotal: true,
        internshipHoursUsed: true,
      },
    }),

    prisma.employeeRate.findMany({
      select: {
        id: true,
        employeeId: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    }),

    prisma.workLog.findMany({
      where: {
        workDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ checkInAt: "asc" }, { createdAt: "asc" }],
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
    }),

    prisma.payrollEntry.count({
      where: {
        status: {
          in: [PayrollStatus.DRAFT, PayrollStatus.PENDING],
        },
      },
    }),

    prisma.payrollEntry.aggregate({
      where: {
        status: {
          in: [PayrollStatus.DRAFT, PayrollStatus.PENDING],
        },
      },
      _sum: {
        amountCents: true,
      },
    }),

    prisma.employee.groupBy({
      by: ["kind"],
      where: { isActive: true },
      _count: { kind: true },
      orderBy: {
        kind: "asc",
      },
    }),

    prisma.payrollEntry.findMany({
      where: {
        status: {
          in: [PayrollStatus.DRAFT, PayrollStatus.PENDING],
        },
      },
      orderBy: [{ periodStart: "desc" }],
      take: 20,
      select: {
        id: true,
        amountCents: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            code: true,
            kind: true,
          },
        },
      },
    }),
  ]);

  const presentToday = todayLogs.filter((l) => l.status !== WorkLogStatus.CANCELED).length;

  const openToday = todayLogs.filter(
    (l) => l.status === WorkLogStatus.OPEN || (!!l.checkInAt && !l.checkOutAt)
  ).length;

  const closedToday = todayLogs.filter(
    (l) => l.status === WorkLogStatus.CLOSED || l.status === WorkLogStatus.APPROVED
  ).length;

  const workedMinutesToday = todayLogs.reduce(
    (acc, l) => acc + Number(l.workedMinutes ?? 0),
    0
  );

  const now = new Date();

  const activeRateEmployeeIds = new Set(
    activeRates
      .filter((r) => {
        const rateFrom = new Date(r.effectiveFrom);
        const rateTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
        return rateFrom <= now && (!rateTo || rateTo >= now);
      })
      .map((r) => r.employeeId)
  );

  const internshipAlerts = activeEmployees
    .filter((e) => e.kind === "INTERN")
    .map((e) => {
      const total = e.internshipHoursTotal ?? null;
      const used = e.internshipHoursUsed ?? 0;
      const remaining = total !== null ? Math.max(0, total - used) : null;

      let level: "info" | "warn" | "danger" = "info";
      if (remaining !== null && remaining <= 0) level = "danger";
      else if (remaining !== null && remaining <= 20) level = "warn";

      return {
        employeeId: e.id,
        fullName: e.fullName,
        code: e.code,
        total,
        used,
        remaining,
        level,
      };
    });

  const openWorklogAlerts = todayLogs
    .filter((l) => l.status === WorkLogStatus.OPEN || (!!l.checkInAt && !l.checkOutAt))
    .map((l) => ({
      id: l.id,
      employeeId: l.employee.id,
      fullName: l.employee.fullName,
      area: l.area,
      checkInAt: l.checkInAt,
    }));

  const employeesWithoutRate = activeEmployees
    .filter((e) => e.kind !== "INTERN")
    .filter((e) => !activeRateEmployeeIds.has(e.id))
    .map((e) => ({
      id: e.id,
      fullName: e.fullName,
      code: e.code,
      kind: e.kind,
    }));

  const employeesWithoutUser = activeEmployees
    .filter((e) => !e.userId)
    .map((e) => ({
      id: e.id,
      fullName: e.fullName,
      code: e.code,
      kind: e.kind,
    }));

  return NextResponse.json({
    ok: true,
    summary: {
      totalActiveEmployees,
      presentToday,
      openToday,
      closedToday,
      workedMinutesToday,
      pendingPayrollCount,
      pendingPayrollAmountCents: pendingPayrollAmountAgg._sum.amountCents ?? 0,
    },
    alerts: {
      internship: internshipAlerts,
      openWorklogs: openWorklogAlerts,
      pendingPayroll: pendingPayrollAlerts,
      withoutRate: employeesWithoutRate,
      withoutUser: employeesWithoutUser,
    },
    activeByKind: activeByKind.map((x) => ({
      kind: x.kind,
      count: x._count.kind,
    })),
    todayLogs,
  });
}