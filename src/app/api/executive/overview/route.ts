// src/app/api/executive/overview/route.ts
import { getIronSession } from "iron-session";
import { PayrollStatus, Prisma, WorkLogStatus } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";

export const runtime = "nodejs";

type ReservationMetricInput = {
  id: string;
  status: string;
  formalizedAt: Date | null;
  source: string | null;
  marketing?: string | null;
  scheduledTime: Date | null;
  activityDate: Date | null;
  service: { name: string | null; category?: string | null } | null;
  channel: { name: string | null } | null;
  totalPriceCents: number | null;
  autoDiscountCents: number | null;
  manualDiscountCents: number | null;
  depositCents: number | null;
  quantity?: number | null;
  isLicense?: boolean | null;
  payments: Array<{
    amountCents: number;
    direction: "IN" | "OUT";
    isDeposit: boolean;
  }>;
  items: Array<{
    isExtra: boolean;
    quantity?: number | null;
    totalPriceCents: number | null;
    service: { name: string | null; category?: string | null } | null;
  }>;
  depositHeld?: boolean;
  createdAt?: Date;
};

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

type OperationsOverviewResponse = {
  summary?: {
    inSea?: number;
    ready?: number;
    unformalized?: number;
    incidentsOpen?: number;
  };
  alerts?: {
    criticalPendingPayments?: unknown[];
  };
} | null;

const reservationExecutiveSelect =
  Prisma.validator<Prisma.ReservationSelect>()({
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
    quantity: true,
    isLicense: true,
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
    service: { select: { name: true, category: true } },
    items: {
      select: {
        isExtra: true,
        quantity: true,
        totalPriceCents: true,
        service: { select: { name: true, category: true } },
      },
    },
  });

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

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>) {
  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
}

function getYmdInTz(
  date: Date,
  tz: string
): { y: number; m: number; d: number } {
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

function addDaysYmd(
  y: number,
  m: number,
  d: number,
  days: number
): { y: number; m: number; d: number } {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);

  return {
    y: base.getUTCFullYear(),
    m: base.getUTCMonth() + 1,
    d: base.getUTCDate(),
  };
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

  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

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
    utcGuess = new Date(
      Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000
    );
  }

  return utcGuess;
}

function tzDayRangeUtc(tz: string, date: Date) {
  const ymd = getYmdInTz(date, tz);
  const start = zonedTimeToUtc(ymd.y, ymd.m, ymd.d, 0, 0, 0, tz);
  const next = addDaysYmd(ymd.y, ymd.m, ymd.d, 1);
  const endExclusive = zonedTimeToUtc(next.y, next.m, next.d, 0, 0, 0, tz);

  return {
    start,
    endExclusive,
    ymd: `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(
      2,
      "0"
    )}`,
  };
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
  payments: Array<{
    amountCents: number;
    direction: "IN" | "OUT";
    isDeposit: boolean;
  }>,
  opts?: { includeDeposits?: boolean }
) {
  const includeDeposits = opts?.includeDeposits ?? true;

  return payments
    .filter((payment) => (includeDeposits ? true : !payment.isDeposit))
    .reduce(
      (sum, payment) =>
        sum +
        (payment.direction === "OUT"
          ? -payment.amountCents
          : payment.amountCents),
      0
    );
}

function buildReservationMetrics(rows: ReservationMetricInput[]) {
  const mapped = rows.map((reservation) => {
    const serviceTotalCents = reservation.items
      .filter((item) => !item.isExtra)
      .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);

    const extrasTotalCents = reservation.items
      .filter((item) => item.isExtra)
      .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);

    const autoDisc = Number(reservation.autoDiscountCents ?? 0);
    const manualDisc = Number(reservation.manualDiscountCents ?? 0);

    const soldTotalCents =
      reservation.items.length > 0
        ? Math.max(
            0,
            serviceTotalCents + extrasTotalCents - autoDisc - manualDisc
          )
        : Number(reservation.totalPriceCents ?? 0);

    const collectedCents = sumSignedPayments(reservation.payments, {
      includeDeposits: true,
    });
    const collectedServiceCents = sumSignedPayments(reservation.payments, {
      includeDeposits: false,
    });
    const pendingServiceCents = Math.max(
      0,
      soldTotalCents - collectedServiceCents
    );

    return {
      id: reservation.id,
      source: reservation.source ?? "—",
      marketing: reservation.marketing ?? "Sin dato",
      channelName: reservation.channel?.name ?? "—",
      serviceName: reservation.service?.name ?? "—",
      soldTotalCents,
      collectedCents,
      pendingCents: pendingServiceCents,
    };
  });

  const totals = mapped.reduce(
    (acc, row) => {
      acc.salesCents += row.soldTotalCents;
      acc.collectedCents += row.collectedCents;
      acc.pendingCents += row.pendingCents;
      return acc;
    },
    { salesCents: 0, collectedCents: 0, pendingCents: 0 }
  );

  const channelsMap = new Map<
    string,
    {
      channel: string;
      reservations: number;
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
    }
  >();

  const servicesMap = new Map<
    string,
    {
      service: string;
      reservations: number;
      quantity: number;
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
    }
  >();

  const marketingMap = new Map<
    string,
    {
      source: string;
      reservations: number;
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
    }
  >();

  for (const row of mapped) {
    const chKey = row.channelName || row.source || "—";
    if (!channelsMap.has(chKey)) {
      channelsMap.set(chKey, {
        channel: chKey,
        reservations: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      });
    }
    const channel = channelsMap.get(chKey)!;
    channel.reservations += 1;
    channel.salesCents += row.soldTotalCents;
    channel.collectedCents += row.collectedCents;
    channel.pendingCents += row.pendingCents;

    const svKey = row.serviceName || "—";
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
    const service = servicesMap.get(svKey)!;
    service.reservations += 1;
    service.quantity += 1;
    service.salesCents += row.soldTotalCents;
    service.collectedCents += row.collectedCents;
    service.pendingCents += row.pendingCents;

    const mkKey = row.marketing || "Sin dato";
    if (!marketingMap.has(mkKey)) {
      marketingMap.set(mkKey, {
        source: mkKey,
        reservations: 0,
        salesCents: 0,
        collectedCents: 0,
        pendingCents: 0,
      });
    }
    const marketing = marketingMap.get(mkKey)!;
    marketing.reservations += 1;
    marketing.salesCents += row.soldTotalCents;
    marketing.collectedCents += row.collectedCents;
    marketing.pendingCents += row.pendingCents;
  }

  const channels = Array.from(channelsMap.values())
    .map((entry) => ({
      ...entry,
      averageTicketCents:
        entry.reservations > 0
          ? Math.round(entry.salesCents / entry.reservations)
          : 0,
    }))
    .sort((a, b) => b.salesCents - a.salesCents);

  const services = Array.from(servicesMap.values())
    .map((entry) => ({
      ...entry,
      averageTicketCents:
        entry.reservations > 0
          ? Math.round(entry.salesCents / entry.reservations)
          : 0,
    }))
    .sort((a, b) => b.salesCents - a.salesCents);

  const marketing = Array.from(marketingMap.values())
    .map((entry) => ({
      ...entry,
      averageTicketCents:
        entry.reservations > 0
          ? Math.round(entry.salesCents / entry.reservations)
          : 0,
    }))
    .sort((a, b) => b.reservations - a.reservations);

  return {
    totals,
    channels,
    marketing,
    services,
    reservations: mapped.length,
    averageTicketCents:
      mapped.length > 0 ? Math.round(totals.salesCents / mapped.length) : 0,
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

function ymdKey(date: Date, tz: string) {
  const { y, m, d } = getYmdInTz(date, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthKeyForDate(date: Date, tz: string) {
  const { y, m } = getYmdInTz(date, tz);
  return `${y}-${String(m).padStart(2, "0")}`;
}

function reservationTimestamp(reservation: ReservationMetricInput) {
  return reservation.scheduledTime ?? reservation.activityDate ?? null;
}

function reservationDepositDueCents(reservation: ReservationMetricInput) {
  return computeReservationDepositCents({
    storedDepositCents: reservation.depositCents,
    quantity: reservation.quantity ?? null,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: reservation.items.map((item) => ({
      quantity: item.quantity ?? 0,
      isExtra: item.isExtra,
      service: { category: item.service?.category ?? null },
    })),
  });
}

function reservationInRange(
  reservation: ReservationMetricInput,
  start: Date,
  endExclusive: Date
) {
  const timestamp = reservationTimestamp(reservation);
  return timestamp != null && timestamp >= start && timestamp < endExclusive;
}

async function loadOperationsOverview() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const baseUrl = envBaseUrl || (host ? `${proto}://${host}` : "");

  if (!baseUrl) return null;

  return fetch(`${baseUrl}/api/operations/overview`, {
    headers: { cookie: cookieHeaderFromStore(cookieStore) },
    cache: "no-store",
  })
    .then(async (response) => (response.ok ? response.json() : null))
    .catch(() => null);
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
    barSaleAgg,
    barProductMarginRows,
    activeInterns,
    lowInternBalance,
    openMaintenanceEvents,
    criticalMaintenanceEvents,
    monthMaintenanceAgg,
    monthExpenses,
    lowStockParts,
    operationsOverview,
    barTodayPayments,
    barMonthPayments,
    lowStockBarCount,
    fulfillmentPending,
    deliveredNotReturned,
    assetCounts,
    assetIncidentsOpen,
    cashByOriginRows,
  ] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: today.start, lt: today.endExclusive } },
          {
            scheduledTime: null,
            activityDate: { gte: today.start, lt: today.endExclusive },
          },
        ],
      },
      select: reservationExecutiveSelect,
    }),
    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: week.start, lt: week.endExclusive } },
          {
            scheduledTime: null,
            activityDate: { gte: week.start, lt: week.endExclusive },
          },
        ],
      },
      select: reservationExecutiveSelect,
    }),
    prisma.reservation.findMany({
      where: {
        OR: [
          { scheduledTime: { gte: month.start, lt: month.endExclusive } },
          {
            scheduledTime: null,
            activityDate: { gte: month.start, lt: month.endExclusive },
          },
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

    prisma.barSale.aggregate({
      where: {
        soldAt: { gte: month.start, lt: month.endExclusive },
      },
      _sum: {
        totalRevenueCents: true,
        totalCostCents: true,
        totalMarginCents: true,
      },
    }),

    prisma.barSaleItem.groupBy({
      by: ["productId"],
      where: {
        sale: {
          soldAt: { gte: month.start, lt: month.endExclusive },
        },
      },
      _sum: {
        revenueCents: true,
        costCents: true,
        marginCents: true,
      },
      _count: {
        _all: true,
      },
    }),

    prisma.employee.count({
      where: {
        isActive: true,
        kind: "INTERN",
      },
    }),
    prisma.employee
      .count({
        where: {
          isActive: true,
          kind: "INTERN",
          internshipHoursTotal: { not: null },
        },
      })
      .then(async (countWithTotal) => {
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

        return rows.filter((employee) => {
          const total = employee.internshipHoursTotal ?? null;
          const used = employee.internshipHoursUsed ?? 0;
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
    prisma.maintenanceEvent
      .count({
        where: {
          severity: { in: ["HIGH", "CRITICAL"] as never[] },
          OR: [
            { resolvedAt: null },
            { status: { in: ["OPEN", "IN_PROGRESS"] as never[] } },
          ],
        },
      })
      .catch(async () => {
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
    prisma.sparePart
      .findMany({
        select: {
          stockQty: true,
          minStockQty: true,
        },
      })
      .then((rows) => {
        return rows.filter(
          (part) =>
            (part.minStockQty ?? 0) > 0 &&
            part.stockQty <= (part.minStockQty ?? 0)
        ).length;
      }),

    loadOperationsOverview(),

    prisma.payment.findMany({
      where: {
        origin: "BAR",
        createdAt: { gte: today.start, lt: today.endExclusive },
        direction: "IN",
      },
      select: {
        amountCents: true,
        isStaffSale: true,
      },
    }),

    prisma.payment.findMany({
      where: {
        origin: "BAR",
        createdAt: { gte: month.start, lt: month.endExclusive },
        direction: "IN",
      },
      select: {
        amountCents: true,
        isStaffSale: true,
      },
    }),
    prisma.barProduct.count({
      where: {
        isActive: true,
        controlsStock: true,
        currentStock: { lte: prisma.barProduct.fields.minStock },
      },
    }),

    prisma.fulfillmentTask.count({
      where: { status: "PENDING" },
    }),
    prisma.fulfillmentTask.count({
      where: {
        type: "EXTRA_DELIVERY",
        status: "DELIVERED",
      },
    }),

    prisma.rentalAsset.groupBy({
      by: ["type", "status"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.rentalAssetIncident.count({
      where: {},
    }),

    prisma.payment.groupBy({
      by: ["origin"],
      where: {
        createdAt: { gte: today.start, lt: today.endExclusive },
        direction: "IN",
      },
      _sum: {
        amountCents: true,
      },
    }),
  ]);

  const marginProductIds = barProductMarginRows.map((r) => r.productId);

  const marginProducts = marginProductIds.length
    ? await prisma.barProduct.findMany({
        where: { id: { in: marginProductIds } },
        select: {
          id: true,
          name: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    : [];

  const marginProductMap = new Map(marginProducts.map((p) => [p.id, p]));

  const barMarginByProduct = barProductMarginRows
    .map((row) => {
      const product = marginProductMap.get(row.productId);

      return {
        product: product?.name ?? "—",
        category: product?.category?.name ?? "—",
        salesCents: Number(row._sum.revenueCents ?? 0),
        costCents: Number(row._sum.costCents ?? 0),
        marginCents: Number(row._sum.marginCents ?? 0),
        tickets: Number(row._count._all ?? 0),
      };
    })
    .sort((a, b) => b.marginCents - a.marginCents)
    .slice(0, 12);

  const todayMetrics = buildReservationMetrics(reservationsToday);
  const weekMetrics = buildReservationMetrics(reservationsWeek);
  const monthMetrics = buildReservationMetrics(reservationsMonth);

  const hrMonth = Number(monthPayrollAgg._sum.amountCents ?? 0);
  const maintenanceMonth = Number(monthMaintenanceAgg._sum.costCents ?? 0);

  const expenseRows = monthExpenses as unknown as MonthExpenseRow[];

  const barExpenseRows = expenseRows.filter(
    (e: MonthExpenseRow) => String(e.costCenter ?? "").toUpperCase() === "BAR"
  );

  const barMonthPurchasesCents = barExpenseRows.reduce(
    (sum: number, e: MonthExpenseRow) =>
      sum + Number(e.totalCents ?? e.amountCents ?? 0),
    0
  );

  const barMonthPurchasesPaidCents = barExpenseRows
    .filter((e: MonthExpenseRow) => e.status === "PAID")
    .reduce(
      (sum: number, e: MonthExpenseRow) =>
        sum + Number(e.totalCents ?? e.amountCents ?? 0),
      0
    );

  const barMonthPurchasesPendingCents = barExpenseRows
    .filter((e: MonthExpenseRow) => e.status === "PENDING")
    .reduce(
      (sum: number, e: MonthExpenseRow) =>
        sum + Number(e.totalCents ?? e.amountCents ?? 0),
      0
    );

  const barVendorMap = new Map<
    string,
    { vendor: string; count: number; totalCents: number }
  >();

  for (const e of barExpenseRows) {
    const vendorName = e.vendor?.name ?? "Sin proveedor";

    if (!barVendorMap.has(vendorName)) {
      barVendorMap.set(vendorName, {
        vendor: vendorName,
        count: 0,
        totalCents: 0,
      });
    }

    const entry = barVendorMap.get(vendorName)!;
    entry.count += 1;
    entry.totalCents += Number(e.totalCents ?? e.amountCents ?? 0);
  }

  const barTopVendors = Array.from(barVendorMap.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 8);

  const barCategoryMap = new Map<
    string,
    { category: string; count: number; totalCents: number }
  >();

  for (const e of barExpenseRows) {
    const categoryName = e.category?.name ?? "Sin categoría";

    if (!barCategoryMap.has(categoryName)) {
      barCategoryMap.set(categoryName, {
        category: categoryName,
        count: 0,
        totalCents: 0,
      });
    }

    const entry = barCategoryMap.get(categoryName)!;
    entry.count += 1;
    entry.totalCents += Number(e.totalCents ?? e.amountCents ?? 0);
  }

  const barPurchasesByCategory = Array.from(barCategoryMap.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 8);

  const cashByOrigin = cashByOriginRows.map((row) => ({
    origin: row.origin,
    collectedTodayCents: Number(row._sum.amountCents ?? 0),
  }));

  const barTodayCents = barTodayPayments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0
  );

  const barMonthCents = barMonthPayments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0
  );

  const barMarginApproxCents = barMonthCents - barMonthPurchasesPaidCents;

  const barTodayStaffCents = barTodayPayments
    .filter((p: { amountCents: number; isStaffSale?: boolean | null }) => Boolean(p.isStaffSale))
    .reduce(
      (sum: number, p: { amountCents: number }) => sum + p.amountCents,
      0
    );

  const barMonthStaffCents = barMonthPayments
    .filter((p: { amountCents: number; isStaffSale?: boolean | null }) => Boolean(p.isStaffSale))
    .reduce(
      (sum: number, p: { amountCents: number }) => sum + p.amountCents,
      0
    );

  const barMonthRegularCents = barMonthCents - barMonthStaffCents;
 
  const operationsOverviewData = operationsOverview as OperationsOverviewResponse;

  const assetSummary: Record<string, Record<string, number>> = {
    GOPRO: { AVAILABLE: 0, DELIVERED: 0, MAINTENANCE: 0, DAMAGED: 0, LOST: 0 },
    WETSUIT: {
      AVAILABLE: 0,
      DELIVERED: 0,
      MAINTENANCE: 0,
      DAMAGED: 0,
      LOST: 0,
    },
    OTHER: { AVAILABLE: 0, DELIVERED: 0, MAINTENANCE: 0, DAMAGED: 0, LOST: 0 },
  };

  for (const row of assetCounts) {
    if (!assetSummary[row.type]) continue;
    assetSummary[row.type][row.status] = row._count._all;
  }

  const health = {
    inSea: Number(operationsOverviewData?.summary?.inSea ?? 0),
    ready: Number(operationsOverviewData?.summary?.ready ?? 0),
    unformalized: Number(operationsOverviewData?.summary?.unformalized ?? 0),
    criticalPayments: Number(
      operationsOverviewData?.alerts?.criticalPendingPayments?.length ?? 0
    ),
    incidentsOpen: Number(operationsOverviewData?.summary?.incidentsOpen ?? 0),
    openWorklogs,
    maintenanceOpen: openMaintenanceEvents,
    maintenanceCritical: criticalMaintenanceEvents,
  };

  const expensesMonthTotal = expenseRows.reduce(
    (sum, expense) => sum + Number(expense.totalCents ?? expense.amountCents ?? 0),
    0
  );

  const expensesMonthPaid = expenseRows
    .filter((expense) => expense.status === "PAID")
    .reduce(
      (sum, expense) =>
        sum + Number(expense.totalCents ?? expense.amountCents ?? 0),
      0
    );

  const expensesMonthPending = expenseRows
    .filter((expense) => expense.status === "PENDING")
    .reduce(
      (sum, expense) =>
        sum + Number(expense.totalCents ?? expense.amountCents ?? 0),
      0
    );

  const expenseCategoryMap = new Map<
    string,
    { category: string; count: number; totalCents: number }
  >();
  for (const expense of expenseRows) {
    const key = expense.category?.name ?? "Sin categoría";
    if (!expenseCategoryMap.has(key)) {
      expenseCategoryMap.set(key, {
        category: key,
        count: 0,
        totalCents: 0,
      });
    }
    const entry = expenseCategoryMap.get(key)!;
    entry.count += 1;
    entry.totalCents += Number(expense.totalCents ?? expense.amountCents ?? 0);
  }
  const expensesByCategory = Array.from(expenseCategoryMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const expenseCostCenterMap = new Map<
    string,
    { costCenter: string; count: number; totalCents: number }
  >();
  for (const expense of expenseRows) {
    const key = expense.costCenter;
    if (!expenseCostCenterMap.has(key)) {
      expenseCostCenterMap.set(key, {
        costCenter: key,
        count: 0,
        totalCents: 0,
      });
    }
    const entry = expenseCostCenterMap.get(key)!;
    entry.count += 1;
    entry.totalCents += Number(expense.totalCents ?? expense.amountCents ?? 0);
  }
  const expensesByCostCenter = Array.from(expenseCostCenterMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const expenseVendorMap = new Map<
    string,
    { vendor: string; count: number; totalCents: number }
  >();
  for (const expense of expenseRows) {
    const vendorName = expense.vendor?.name ?? "Sin proveedor";
    if (!expenseVendorMap.has(vendorName)) {
      expenseVendorMap.set(vendorName, {
        vendor: vendorName,
        count: 0,
        totalCents: 0,
      });
    }
    const entry = expenseVendorMap.get(vendorName)!;
    entry.count += 1;
    entry.totalCents += Number(expense.totalCents ?? expense.amountCents ?? 0);
  }
  const expensesByVendor = Array.from(expenseVendorMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const estimatedMarginCents =
    monthMetrics.totals.salesCents -
    hrMonth -
    maintenanceMonth -
    expensesMonthTotal;
  const cashMarginCents =
    monthMetrics.totals.collectedCents -
    hrMonth -
    maintenanceMonth -
    expensesMonthPaid;

  const dayPoints: Array<{
    date: string;
    start: Date;
    endExclusive: Date;
  }> = [];

  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const range = tzDayRangeUtc(tz, day);

    dayPoints.push({
      date: range.ymd,
      start: range.start,
      endExclusive: range.endExclusive,
    });
  }

  const monthKeys: Array<{
    year: number;
    month: number;
    key: string;
    start: Date;
    endExclusive: Date;
  }> = [];
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

  const [trendReservations30d, trendApprovedWorklogs30d, trendReservations6m, payrollRows6m, maintenanceRows6m] =
    await Promise.all([
      prisma.reservation.findMany({
        where: {
          OR: [
            {
              scheduledTime: {
                gte: dayPoints[0].start,
                lt: dayPoints[dayPoints.length - 1].endExclusive,
              },
            },
            {
              scheduledTime: null,
              activityDate: {
                gte: dayPoints[0].start,
                lt: dayPoints[dayPoints.length - 1].endExclusive,
              },
            },
          ],
        },
        select: reservationExecutiveSelect,
      }),
      prisma.workLog.findMany({
        where: {
          status: WorkLogStatus.APPROVED,
          workDate: {
            gte: dayPoints[0].start,
            lt: dayPoints[dayPoints.length - 1].endExclusive,
          },
        },
        select: {
          workDate: true,
          workedMinutes: true,
        },
      }),
      prisma.reservation.findMany({
        where: {
          OR: [
            {
              scheduledTime: {
                gte: monthKeys[0].start,
                lt: monthKeys[monthKeys.length - 1].endExclusive,
              },
            },
            {
              scheduledTime: null,
              activityDate: {
                gte: monthKeys[0].start,
                lt: monthKeys[monthKeys.length - 1].endExclusive,
              },
            },
          ],
        },
        select: reservationExecutiveSelect,
      }),
      prisma.payrollEntry.findMany({
        where: {
          periodStart: {
            gte: monthKeys[0].start,
            lt: monthKeys[monthKeys.length - 1].endExclusive,
          },
        },
        select: {
          periodStart: true,
          amountCents: true,
        },
      }),
      prisma.maintenanceEvent.findMany({
        where: {
          createdAt: {
            gte: monthKeys[0].start,
            lt: monthKeys[monthKeys.length - 1].endExclusive,
          },
        },
        select: {
          createdAt: true,
          costCents: true,
        },
      }),
    ]);

  const approvedMinutesByDay = new Map<string, number>();
  for (const worklog of trendApprovedWorklogs30d) {
    const key = ymdKey(worklog.workDate, tz);
    approvedMinutesByDay.set(
      key,
      (approvedMinutesByDay.get(key) ?? 0) + Number(worklog.workedMinutes ?? 0)
    );
  }

  const trendDays = dayPoints.map((point) => {
    const metrics = buildReservationMetrics(
      trendReservations30d.filter((reservation) =>
        reservationInRange(reservation, point.start, point.endExclusive)
      )
    );

    return {
      date: point.date,
      salesCents: metrics.totals.salesCents,
      collectedCents: metrics.totals.collectedCents,
      pendingCents: metrics.totals.pendingCents,
      reservations: metrics.reservations,
      approvedMinutes: approvedMinutesByDay.get(point.date) ?? 0,
    };
  });

  const reservationsByMonth = new Map<string, ReservationMetricInput[]>();
  for (const reservation of trendReservations6m) {
    const timestamp = reservationTimestamp(reservation);
    if (!timestamp) continue;
    const key = monthKeyForDate(timestamp, tz);
    const current = reservationsByMonth.get(key) ?? [];
    current.push(reservation);
    reservationsByMonth.set(key, current);
  }

  const payrollByMonth = new Map<string, number>();
  for (const payroll of payrollRows6m) {
    const key = monthKeyForDate(payroll.periodStart, tz);
    payrollByMonth.set(
      key,
      (payrollByMonth.get(key) ?? 0) + Number(payroll.amountCents ?? 0)
    );
  }

  const maintenanceByMonth = new Map<
    string,
    { costCents: number; events: number }
  >();
  for (const event of maintenanceRows6m) {
    const key = monthKeyForDate(event.createdAt, tz);
    const current = maintenanceByMonth.get(key) ?? { costCents: 0, events: 0 };
    current.costCents += Number(event.costCents ?? 0);
    current.events += 1;
    maintenanceByMonth.set(key, current);
  }

  const trends = {
    days7: trendDays.slice(-7),
    days30: trendDays,
    months6: monthKeys.map((monthKey) => {
      const metrics = buildReservationMetrics(
        reservationsByMonth.get(monthKey.key) ?? []
      );
      const payrollCents = payrollByMonth.get(monthKey.key) ?? 0;
      const maintenance = maintenanceByMonth.get(monthKey.key) ?? {
        costCents: 0,
        events: 0,
      };

      return {
        month: monthKey.key,
        salesCents: metrics.totals.salesCents,
        payrollCents,
        maintenanceCents: maintenance.costCents,
        estimatedMarginCents:
          metrics.totals.salesCents - payrollCents - maintenance.costCents,
        maintenanceEvents: maintenance.events,
      };
    }),
  };

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
    bar: {
      todaySalesCents: barTodayCents,
      todayStaffSalesCents: barTodayStaffCents,
      monthSalesCents: barMonthCents,
      lowStockCount: lowStockBarCount,
    },
    assets: {
      summary: assetSummary,
      incidentsOpen: assetIncidentsOpen,
    },
    fulfillment: {
      pending: fulfillmentPending,
      deliveredNotReturned,
    },
    cashByOrigin,
    barAccounting: {
      monthSalesCents: barMonthCents,
      monthRegularSalesCents: barMonthRegularCents,
      monthStaffSalesCents: barMonthStaffCents,
      monthPurchasesCents: barMonthPurchasesCents,
      monthPurchasesPaidCents: barMonthPurchasesPaidCents,
      monthPurchasesPendingCents: barMonthPurchasesPendingCents,
      marginApproxCents: barMarginApproxCents,
      marginRealCents: Number(barSaleAgg._sum.totalMarginCents ?? 0),
      costTheoreticalCents: Number(barSaleAgg._sum.totalCostCents ?? 0),
      topMarginProducts: barMarginByProduct,
      topVendors: barTopVendors,
      byCategory: barPurchasesByCategory,
    },
    cash: {
      collectedTodayCents: todayMetrics.totals.collectedCents,
      pendingTodayCents: todayMetrics.totals.pendingCents,
      depositsReturnedCents: reservationsToday.reduce((sum, reservation) => {
        const returned = reservation.payments
          .filter((payment) => payment.isDeposit && payment.direction === "OUT")
          .reduce((acc, payment) => acc + payment.amountCents, 0);

        return sum + returned;
      }, 0),
      depositsHeldCents: reservationsToday.reduce(
        (sum, reservation) =>
          sum + (reservation.depositHeld ? reservationDepositDueCents(reservation) : 0),
        0
      ),
      depositsLiberableCents: reservationsToday.reduce(
        (sum, reservation) => {
          const paidDeposit = reservation.payments
            .filter((payment) => payment.isDeposit)
            .reduce(
              (acc, payment) =>
                acc +
                (payment.direction === "OUT"
                  ? -payment.amountCents
                  : payment.amountCents),
              0
            );

          return sum + (reservation.depositHeld ? 0 : Math.max(0, paidDeposit));
        },
        0
      ),
      depositsRetainedNetCents: reservationsToday.reduce((sum, reservation) => {
        if (!reservation.depositHeld) return sum;

        const netDeposit = reservation.payments
          .filter((payment) => payment.isDeposit)
          .reduce(
            (acc, payment) =>
              acc +
              (payment.direction === "OUT"
                ? -payment.amountCents
                : payment.amountCents),
            0
          );

        return sum + Math.max(0, netDeposit);
      }, 0),
      reservationsWithDebt: reservationsToday.filter((reservation) => {
        const sold =
          reservation.items.length > 0
            ? Math.max(
                0,
                reservation.items.reduce(
                  (sum, item) => sum + Number(item.totalPriceCents ?? 0),
                  0
                ) -
                  Number(reservation.autoDiscountCents ?? 0) -
                  Number(reservation.manualDiscountCents ?? 0)
              )
            : Number(reservation.totalPriceCents ?? 0);

        const collectedService = reservation.payments
          .filter((payment) => !payment.isDeposit)
          .reduce(
            (acc, payment) =>
              acc +
              (payment.direction === "OUT"
                ? -payment.amountCents
                : payment.amountCents),
            0
          );

        return Math.max(0, sold - collectedService) > 0;
      }).length,
    },
    trends,
  });
}
