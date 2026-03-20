// src/app/api/executive/overview/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { PayrollStatus, WorkLogStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}

function getYmdInTz(date: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const s = fmt.format(date);
  const [yy, mm, dd] = s.split("-").map(Number);
  return { y: yy, m: mm, d: dd };
}

function addDaysYmd(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tz: string
): Date {
  let utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));

  for (let i = 0; i < 2; i++) {
    const offsetMin = tzOffsetMinutes(utcGuess, tz);
    utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000);
  }

  return utcGuess;
}

function tzDayRangeUtc(tz: string, date: Date) {
  const ymd = getYmdInTz(date, tz);
  const start = zonedTimeToUtc(ymd.y, ymd.m, ymd.d, 0, 0, 0, tz);
  const next = addDaysYmd(ymd.y, ymd.m, ymd.d, 1);
  const endExclusive = zonedTimeToUtc(next.y, next.m, next.d, 0, 0, 0, tz);
  return { start, endExclusive, ymd: `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}` };
}

function tzWeekRangeUtc(tz: string, date: Date) {
  const ymd = getYmdInTz(date, tz);
  const base = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d));
  const dow = base.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  base.setUTCDate(base.getUTCDate() + diff);

  const start = zonedTimeToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    0,
    0,
    0,
    tz
  );

  const endBase = new Date(base);
  endBase.setUTCDate(endBase.getUTCDate() + 7);

  const endExclusive = zonedTimeToUtc(
    endBase.getUTCFullYear(),
    endBase.getUTCMonth() + 1,
    endBase.getUTCDate(),
    0,
    0,
    0,
    tz
  );

  return { start, endExclusive };
}

function tzMonthRangeUtc(tz: string, date: Date) {
  const ymd = getYmdInTz(date, tz);

  const start = zonedTimeToUtc(ymd.y, ymd.m, 1, 0, 0, 0, tz);

  const nextMonthY = ymd.m === 12 ? ymd.y + 1 : ymd.y;
  const nextMonthM = ymd.m === 12 ? 1 : ymd.m + 1;

  const endExclusive = zonedTimeToUtc(nextMonthY, nextMonthM, 1, 0, 0, 0, tz);

  return {
    start,
    endExclusive,
    monthKey: `${ymd.y}-${String(ymd.m).padStart(2, "0")}`,
  };
}

function sumSignedPayments(
  payments: Array<{ amountCents: number; direction: "IN" | "OUT"; isDeposit: boolean }>,
  opts?: { includeDeposits?: boolean }
) {
  const includeDeposits = opts?.includeDeposits ?? true;
  return payments
    .filter((p) => (includeDeposits ? true : !p.isDeposit))
    .reduce((sum, p) => sum + (p.direction === "OUT" ? -p.amountCents : p.amountCents), 0);
}

function buildReservationMetrics(rows: ReservationMetricInput[]) {
  const mapped = rows.map((r) => {
    const serviceTotalCents = r.items
      .filter((it) => !it.isExtra)
      .reduce((sum, it) => sum + Number(it.totalPriceCents ?? 0), 0);

    const extrasTotalCents = r.items
      .filter((it) => it.isExtra)
      .reduce((sum, it) => sum + Number(it.totalPriceCents ?? 0), 0);

    const autoDisc = Number(r.autoDiscountCents ?? 0);
    const manualDisc = Number(r.manualDiscountCents ?? 0);

    const soldTotalCents =
      r.items.length > 0
        ? Math.max(0, serviceTotalCents + extrasTotalCents - autoDisc - manualDisc)
        : Number(r.totalPriceCents ?? 0);

    const collectedCents = sumSignedPayments(r.payments, { includeDeposits: true });
    const collectedServiceCents = sumSignedPayments(r.payments, { includeDeposits: false });
    const pendingServiceCents = Math.max(0, soldTotalCents - collectedServiceCents);

    return {
      id: r.id,
      source: r.source ?? "—",
      marketing: r.marketing ?? "Sin dato",
      channelName: r.channel?.name ?? "—",
      serviceName: r.service?.name ?? "—",
      soldTotalCents,
      collectedCents,
      pendingCents: pendingServiceCents,
    };
  });

  const totals = mapped.reduce(
    (acc, r) => {
      acc.salesCents += r.soldTotalCents;
      acc.collectedCents += r.collectedCents;
      acc.pendingCents += r.pendingCents;
      return acc;
    },
    { salesCents: 0, collectedCents: 0, pendingCents: 0 }
  );

  const channelsMap = new Map<
    string,
    { channel: string; reservations: number; salesCents: number; collectedCents: number; pendingCents: number }
  >();

  const servicesMap = new Map<
    string,
    { service: string; reservations: number; quantity: number; salesCents: number; collectedCents: number; pendingCents: number }
  >();
  const marketingMap = new Map<
    string,
    { source: string; reservations: number; salesCents: number; collectedCents: number; pendingCents: number }
  >();

  for (const r of mapped) {
    const chKey = r.channelName || r.source || "—";
    if (!channelsMap.has(chKey)) {
      channelsMap.set(chKey, {
        channel: chKey,
        reservations: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      });
    }
    const ch = channelsMap.get(chKey)!;
    ch.reservations += 1;
    ch.salesCents += r.soldTotalCents;
    ch.collectedCents += r.collectedCents;
    ch.pendingCents += r.pendingCents;

    const svKey = r.serviceName || "—";
    if (!servicesMap.has(svKey)) {
      servicesMap.set(svKey, {
        service: svKey,
        reservations: 0,
        quantity: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      });
    }
    const sv = servicesMap.get(svKey)!;
    sv.reservations += 1;
    sv.quantity += 1;
    sv.salesCents += r.soldTotalCents;
    sv.collectedCents += r.collectedCents;
    sv.pendingCents += r.pendingCents;

    const mkKey = r.marketing || "Sin dato";
    if (!marketingMap.has(mkKey)) {
      marketingMap.set(mkKey, {
        source: mkKey,
        reservations: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      });
    }
    const mk = marketingMap.get(mkKey)!;
    mk.reservations += 1;
    mk.salesCents += r.soldTotalCents;
    mk.collectedCents += r.collectedCents;
    mk.pendingCents += r.pendingCents;
  }

  const channels = Array.from(channelsMap.values())
    .map((x) => ({
      ...x,
      averageTicketCents: x.reservations > 0 ? Math.round(x.salesCents / x.reservations) : 0,
    }))
    .sort((a, b) => b.salesCents - a.salesCents);

  const services = Array.from(servicesMap.values())
    .map((x) => ({
      ...x,
      averageTicketCents: x.reservations > 0 ? Math.round(x.salesCents / x.reservations) : 0,
    }))
    .sort((a, b) => b.salesCents - a.salesCents);

  const marketing = Array.from(marketingMap.values())
    .map((x) => ({
      ...x,
      averageTicketCents: x.reservations > 0 ? Math.round(x.salesCents / x.reservations) : 0,
    }))
    .sort((a, b) => b.reservations - a.reservations);

  return {
    totals,
    channels,
    marketing,
    services,
    reservations: mapped.length,
    averageTicketCents: mapped.length > 0 ? Math.round(totals.salesCents / mapped.length) : 0,
  };
}

function monthStartUtc(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
}

function nextMonth(year: number, month1to12: number) {
  return month1to12 === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month1to12 + 1 };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const tz = process.env.BUSINESS_TZ || "Europe/Madrid";

  const today = tzDayRangeUtc(tz, now);
  const week = tzWeekRangeUtc(tz, now);
  const month = tzMonthRangeUtc(tz, now);

  const [
    reservationsToday,
    reservationsWeek,
    reservationsMonth,

    openWorklogs,
    approvedToday,
    approvedWeek,
    approvedMonth,

    pendingPayrollAgg,
    monthPayrollAgg,

    activeInterns,
    lowInternBalance,

    openMaintenanceEvents,
    criticalMaintenanceEvents,
    monthMaintenanceAgg,
    monthExpenses,
    lowStockParts,
    operationsOverview,
  ] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: today.start, lt: today.endExclusive } },
          { scheduledTime: null, activityDate: { gte: today.start, lt: today.endExclusive } },
        ],
      },
      select: reservationExecutiveSelect,
    }),

    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: week.start, lt: week.endExclusive } },
          { scheduledTime: null, activityDate: { gte: week.start, lt: week.endExclusive } },
        ],
      },
      select: reservationExecutiveSelect,
    }),

    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: month.start, lt: month.endExclusive } },
          { scheduledTime: null, activityDate: { gte: month.start, lt: month.endExclusive } },
        ],
      },
      select: reservationExecutiveSelect,
    }),

    prisma.workLog.count({
      where: {
        status: WorkLogStatus.OPEN,
      },
    }),

    prisma.workLog.aggregate({
      where: {
        status: WorkLogStatus.APPROVED,
        workDate: { gte: today.start, lt: today.endExclusive },
      },
      _sum: { workedMinutes: true },
    }),

    prisma.workLog.aggregate({
      where: {
        status: WorkLogStatus.APPROVED,
        workDate: { gte: week.start, lt: week.endExclusive },
      },
      _sum: { workedMinutes: true },
    }),

    prisma.workLog.aggregate({
      where: {
        status: WorkLogStatus.APPROVED,
        workDate: { gte: month.start, lt: month.endExclusive },
      },
      _sum: { workedMinutes: true },
    }),

    prisma.payrollEntry.aggregate({
      where: {
        status: { in: [PayrollStatus.DRAFT, PayrollStatus.PENDING] },
      },
      _sum: { amountCents: true },
    }),

    prisma.payrollEntry.aggregate({
      where: {
        periodStart: { gte: month.start, lt: month.endExclusive },
      },
      _sum: { amountCents: true },
    }),

    prisma.employee.count({
      where: {
        isActive: true,
        kind: "INTERN",
      },
    }),

    prisma.employee.count({
      where: {
        isActive: true,
        kind: "INTERN",
        internshipHoursTotal: { not: null },
      },
    }).then(async (countWithTotal) => {
      if (countWithTotal === 0) return 0;
      const rows = await prisma.employee.findMany({
        where: {
          isActive: true,
          kind: "INTERN",
          internshipHoursTotal: { not: null },
        },
        select: {
          internshipHoursTotal: true,
          internshipHoursUsed: true,
        },
      });
      return rows.filter((e) => {
        const total = e.internshipHoursTotal ?? null;
        const used = e.internshipHoursUsed ?? 0;
        const remaining = total !== null ? total - used : null;
        return remaining !== null && remaining <= 20;
      }).length;
    }),

    prisma.maintenanceEvent.count({
      where: {
        OR: [
          { resolvedAt: null },
          { status: { in: ["OPEN", "IN_PROGRESS"] as never[] } },
        ],
      },
    }),

    prisma.maintenanceEvent.count({
      where: {
        severity: { in: ["HIGH", "CRITICAL"] as never[] },
        OR: [
          { resolvedAt: null },
          { status: { in: ["OPEN", "IN_PROGRESS"] as never[] } },
        ],
      },
    }).catch(async () => {
      return prisma.maintenanceEvent.count({
        where: {
          resolvedAt: null,
        },
      });
    }),

    prisma.maintenanceEvent.aggregate({
      where: {
        createdAt: { gte: month.start, lt: month.endExclusive },
      },
      _sum: {
        costCents: true,
        partsCostCents: true,
        laborCostCents: true,
      },
    }),

    prisma.expense.findMany({
      where: {
        expenseDate: { gte: month.start, lt: month.endExclusive },
        status: { in: ["PENDING", "PAID"] },
      },
      select: {
        id: true,
        status: true,
        costCenter: true,
        amountCents: true,
        taxCents: true,
        totalCents: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    
    prisma.sparePart.findMany({
      select: {
        stockQty: true,
        minStockQty: true,
      },
    }).then((rows) => {
      return rows.filter((p) => (p.minStockQty ?? 0) > 0 && p.stockQty <= (p.minStockQty ?? 0)).length;
    }),

    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/operations/overview`, {
      headers: { cookie: cookieHeaderFromStore(await cookies()) },
      cache: "no-store",
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  type MonthExpenseRow = {
    id: string;
    status: "PENDING" | "PAID" | "DRAFT" | "CANCELED";
    costCenter: string;
    amountCents: number;
    taxCents: number | null;
    totalCents: number | null;
    vendor: {
      id: string;
      name: string;
    } | null;
    category: {
      id: string;
      name: string;
    } | null;
  };

  const todayMetrics = buildReservationMetrics(reservationsToday);
  const weekMetrics = buildReservationMetrics(reservationsWeek);
  const monthMetrics = buildReservationMetrics(reservationsMonth);

  const health = {
    inSea: Number(operationsOverview?.summary?.inSea ?? 0),
    ready: Number(operationsOverview?.summary?.ready ?? 0),
    unformalized: Number(operationsOverview?.summary?.unformalized ?? 0),
    criticalPayments: Number(
      operationsOverview?.alerts?.criticalPendingPayments?.length ?? 0
    ),
    incidentsOpen: Number(operationsOverview?.summary?.incidentsOpen ?? 0),
    openWorklogs,
    maintenanceOpen: openMaintenanceEvents,
    maintenanceCritical: criticalMaintenanceEvents,
  };

  const hrMonth = Number(monthPayrollAgg._sum.amountCents ?? 0);
  const maintenanceMonth = Number(monthMaintenanceAgg._sum.costCents ?? 0);
  
  const expenseRows = monthExpenses as unknown as MonthExpenseRow[];

  const expensesMonthTotal = expenseRows.reduce(
    (sum: number, e: MonthExpenseRow) => sum + Number(e.totalCents ?? e.amountCents ?? 0),
    0
  );

  const expensesMonthPaid = expenseRows
    .filter((e: MonthExpenseRow) => e.status === "PAID")
    .reduce((sum: number, e: MonthExpenseRow) => sum + Number(e.totalCents ?? e.amountCents ?? 0), 0);

  const expensesMonthPending = expenseRows
    .filter((e: MonthExpenseRow) => e.status === "PENDING")
    .reduce((sum: number, e: MonthExpenseRow) => sum + Number(e.totalCents ?? e.amountCents ?? 0), 0);

  const expenseCategoryMap = new Map<
    string,
    { category: string; count: number; totalCents: number }
  >();

  for (const e of expenseRows) {
    const key = e.category?.name ?? "Sin categoría";
    if (!expenseCategoryMap.has(key)) {
      expenseCategoryMap.set(key, {
        category: key,
        count: 0,
        totalCents: 0,
      });
    }
    const entry = expenseCategoryMap.get(key)!;
    entry.count += 1;
    entry.totalCents += Number(e.totalCents ?? e.amountCents ?? 0);
  }

  const expensesByCategory = Array.from(expenseCategoryMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const expenseCostCenterMap = new Map<
    string,
    { costCenter: string; count: number; totalCents: number }
  >();

  for (const e of expenseRows) {
    const key = e.costCenter;
    if (!expenseCostCenterMap.has(key)) {
      expenseCostCenterMap.set(key, {
        costCenter: key,
        count: 0,
        totalCents: 0,
      });
    }
    const entry = expenseCostCenterMap.get(key)!;
    entry.count += 1;
    entry.totalCents += Number(e.totalCents ?? e.amountCents ?? 0);
  }

  const expensesByCostCenter = Array.from(expenseCostCenterMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const expenseVendorMap = new Map<
    string,
    { vendor: string; count: number; totalCents: number }
  >();

  for (const e of expenseRows) {
    const vendorName = e.vendor?.name ?? "Sin proveedor";

    if (!expenseVendorMap.has(vendorName)) {
      expenseVendorMap.set(vendorName, {
        vendor: vendorName,
        count: 0,
        totalCents: 0,
      });
    }

    const entry = expenseVendorMap.get(vendorName)!;
    entry.count += 1;
    entry.totalCents += Number(e.totalCents ?? e.amountCents ?? 0);
  }

  const expensesByVendor = Array.from(expenseVendorMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );
  
  const estimatedMarginCents =
  monthMetrics.totals.salesCents - hrMonth - maintenanceMonth - expensesMonthTotal;
  const cashMarginCents =
  monthMetrics.totals.collectedCents - hrMonth - maintenanceMonth - expensesMonthPaid;

  // Trends 7d / 30d
  const dayPoints: Array<{
    date: string;
    start: Date;
    endExclusive: Date;
  }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const range = tzDayRangeUtc(tz, d);
    dayPoints.push({
      date: range.ymd,
      start: range.start,
      endExclusive: range.endExclusive,
    });
  }

  const trendDays = await Promise.all(
    dayPoints.map(async (p) => {
      const [resRows, approvedAgg] = await Promise.all([
        prisma.reservation.findMany({
          where: {
            OR: [
              { scheduledTime: { gte: p.start, lt: p.endExclusive } },
              { scheduledTime: null, activityDate: { gte: p.start, lt: p.endExclusive } },
            ],
          },
          select: reservationExecutiveSelect,
        }),
        prisma.workLog.aggregate({
          where: {
            status: WorkLogStatus.APPROVED,
            workDate: { gte: p.start, lt: p.endExclusive },
          },
          _sum: { workedMinutes: true },
        }),
      ]);

      const metrics = buildReservationMetrics(resRows);

      return {
        date: p.date,
        salesCents: metrics.totals.salesCents,
        collectedCents: metrics.totals.collectedCents,
        pendingCents: metrics.totals.pendingCents,
        reservations: metrics.reservations,
        approvedMinutes: Number(approvedAgg._sum.workedMinutes ?? 0),
      };
    })
  );

  const trends = {
    days7: trendDays.slice(-7),
    days30: trendDays,
    months6: [] as Array<{
      month: string;
      salesCents: number;
      payrollCents: number;
      maintenanceCents: number;
      estimatedMarginCents: number;
      maintenanceEvents: number;
    }>,
  };

  const monthKeys: Array<{ year: number; month: number; key: string; start: Date; endExclusive: Date }> = [];
  const monthAnchor = getYmdInTz(now, tz);

  for (let i = 5; i >= 0; i--) {
    const dt = new Date(Date.UTC(monthAnchor.y, monthAnchor.m - 1 - i, 1));
    const year = dt.getUTCFullYear();
    const monthNum = dt.getUTCMonth() + 1;
    const key = `${year}-${String(monthNum).padStart(2, "0")}`;
    const start = monthStartUtc(year, monthNum);
    const nm = nextMonth(year, monthNum);
    const endExclusive = monthStartUtc(nm.year, nm.month);
    monthKeys.push({ year, month: monthNum, key, start, endExclusive });
  }

  trends.months6 = await Promise.all(
    monthKeys.map(async (m) => {
      const [resRows, payrollAgg, maintenanceAgg, maintenanceEventsAgg] = await Promise.all([
        prisma.reservation.findMany({
          where: {
            OR: [
              { scheduledTime: { gte: m.start, lt: m.endExclusive } },
              { scheduledTime: null, activityDate: { gte: m.start, lt: m.endExclusive } },
            ],
          },
          select: reservationExecutiveSelect,
        }),
        prisma.payrollEntry.aggregate({
          where: {
            periodStart: { gte: m.start, lt: m.endExclusive },
          },
          _sum: { amountCents: true },
        }),
        prisma.maintenanceEvent.aggregate({
          where: {
            createdAt: { gte: m.start, lt: m.endExclusive },
          },
          _sum: { costCents: true },
        }),
        prisma.maintenanceEvent.count({
          where: {
            createdAt: { gte: m.start, lt: m.endExclusive },
          },
        }),
      ]);

      const metrics = buildReservationMetrics(resRows);
      const payrollCents = Number(payrollAgg._sum.amountCents ?? 0);
      const maintenanceCents = Number(maintenanceAgg._sum.costCents ?? 0);

      return {
        month: m.key,
        salesCents: metrics.totals.salesCents,
        payrollCents,
        maintenanceCents,
        estimatedMarginCents: metrics.totals.salesCents - payrollCents - maintenanceCents,
        maintenanceEvents: maintenanceEventsAgg,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    ranges: {
      today: {
        start: today.start.toISOString(),
        endExclusive: today.endExclusive.toISOString(),
      },
      week: {
        start: week.start.toISOString(),
        endExclusive: week.endExclusive.toISOString(),
      },
      month: {
        start: month.start.toISOString(),
        endExclusive: month.endExclusive.toISOString(),
      },
    },
    expenses: {
      monthTotalCents: expensesMonthTotal,
      monthPaidCents: expensesMonthPaid,
      monthPendingCents: expensesMonthPending,
      monthCount: expenseRows.length,
      byCategory: expensesByCategory,
      byCostCenter: expensesByCostCenter,
      byVendor: expensesByVendor,
    },
    kpis: {
      today: {
        salesCents: todayMetrics.totals.salesCents,
        collectedCents: todayMetrics.totals.collectedCents,
        pendingCents: todayMetrics.totals.pendingCents,
        reservations: todayMetrics.reservations,
      },
      week: {
        salesCents: weekMetrics.totals.salesCents,
        collectedCents: weekMetrics.totals.collectedCents,
        pendingCents: weekMetrics.totals.pendingCents,
        reservations: weekMetrics.reservations,
        averageTicketCents: weekMetrics.averageTicketCents,
      },
      month: {
        salesCents: monthMetrics.totals.salesCents,
        collectedCents: monthMetrics.totals.collectedCents,
        pendingCents: monthMetrics.totals.pendingCents,
        reservations: monthMetrics.reservations,
        averageTicketCents: monthMetrics.averageTicketCents,
        estimatedMarginCents,
        cashMarginCents,
      },
    },
    health,
    channels: monthMetrics.channels,
    marketing: monthMetrics.marketing,
    services: monthMetrics.services,
    hr: {
      approvedMinutesToday: Number(approvedToday._sum.workedMinutes ?? 0),
      approvedMinutesWeek: Number(approvedWeek._sum.workedMinutes ?? 0),
      approvedMinutesMonth: Number(approvedMonth._sum.workedMinutes ?? 0),
      pendingPayrollCents: Number(pendingPayrollAgg._sum.amountCents ?? 0),
      monthPayrollCents: hrMonth,
      activeInterns,
      internshipLowBalance: lowInternBalance,
    },
    mechanics: {
      openEvents: openMaintenanceEvents,
      criticalEvents: criticalMaintenanceEvents,
      monthCostCents: Number(monthMaintenanceAgg._sum.costCents ?? 0),
      monthPartsCostCents: Number(monthMaintenanceAgg._sum.partsCostCents ?? 0),
      monthLaborCostCents: Number(monthMaintenanceAgg._sum.laborCostCents ?? 0),
      lowStockParts,
    },
    cash: {
      collectedTodayCents: todayMetrics.totals.collectedCents,
      pendingTodayCents: todayMetrics.totals.pendingCents,
      depositsHeldCents: reservationsToday.reduce(
        (sum, r) => sum + (r.depositHeld ? Number(r.depositCents ?? 0) : 0),
        0
      ),
      depositsLiberableCents: reservationsToday.reduce((sum: number, r: ReservationMetricInput) => {
      const paidDeposit = r.payments
          .filter((p: ReservationMetricInput["payments"][number]) => p.isDeposit)
          .reduce(
          (acc: number, p: ReservationMetricInput["payments"][number]) =>
              acc + (p.direction === "OUT" ? -p.amountCents : p.amountCents),
          0
      );

      return sum + (r.depositHeld ? 0 : Math.max(0, paidDeposit));
      }, 0),
      reservationsWithDebt: reservationsToday.filter((r: ReservationMetricInput) => {
        const sold =
            r.items.length > 0
            ? Math.max(
                0,
                r.items.reduce(
                    (s: number, it: ReservationMetricInput["items"][number]) =>
                    s + Number(it.totalPriceCents ?? 0),
                    0
                ) -
                    Number(r.autoDiscountCents ?? 0) -
                    Number(r.manualDiscountCents ?? 0)
                )
            : Number(r.totalPriceCents ?? 0);

        const collectedService = r.payments
            .filter((p: ReservationMetricInput["payments"][number]) => !p.isDeposit)
            .reduce(
            (acc: number, p: ReservationMetricInput["payments"][number]) =>
                acc + (p.direction === "OUT" ? -p.amountCents : p.amountCents),
            0
            );

        return Math.max(0, sold - collectedService) > 0;
        }).length,
            },
            trends,
        });
        }

const reservationExecutiveSelect = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  status: true,
  formalizedAt: true,
  source: true,
  marketing: true,
  scheduledTime: true,
  activityDate: true,
  totalPriceCents: true,
  autoDiscountCents: true,
  manualDiscountCents: true,
  depositCents: true,
  depositHeld: true,
  createdAt: true,
  payments: {
    select: {
      amountCents: true,
      direction: true,
      isDeposit: true,
    },
  },
  channel: { select: { name: true } },
  service: { select: { name: true } },
  items: {
    select: {
      isExtra: true,
      totalPriceCents: true,
      service: { select: { name: true } },
    },
  },
});

type ReservationMetricInput = {
    id: string;
    status: string;
    formalizedAt: Date | null;
    source: string | null;
    marketing?: string | null;
    scheduledTime: Date | null;
    activityDate: Date | null;
    service: { name: string | null } | null;
    channel: { name: string | null } | null;
    totalPriceCents: number | null;
    autoDiscountCents: number | null;
    manualDiscountCents: number | null;
    depositCents: number | null;
    payments: Array<{
        amountCents: number;
        direction: "IN" | "OUT";
        isDeposit: boolean;
    }>;
    items: Array<{
        isExtra: boolean;
        totalPriceCents: number | null;
        service: { name: string | null } | null;
    }>;
    depositHeld?: boolean;
    createdAt?: Date;
    };

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>) {
  return store
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}
