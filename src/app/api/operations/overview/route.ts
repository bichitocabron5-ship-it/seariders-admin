// src/app/api/operations/overview/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";

export const runtime = "nodejs";

async function requireOpsOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (["ADMIN", "STORE", "PLATFORM", "BOOTH"].includes(session.role as string)) {
    return session;
  }
  return null;
}

function tzDayRangeUtc(tz: string, arg1: Date): { start: Date; endExclusive: Date } {
  const ymd = getYmdInTz(arg1, tz);

  const start = zonedTimeToUtc(ymd.y, ymd.m, ymd.d, 0, 0, 0, tz);

  const next = addDaysYmd(ymd.y, ymd.m, ymd.d, 1);
  const endExclusive = zonedTimeToUtc(next.y, next.m, next.d, 0, 0, 0, tz);

  return { start, endExclusive };
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

function minutesDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

function labelRentalAssetStatus(status: string) {
  switch (status) {
    case "MAINTENANCE":
      return "Mantenimiento";
    case "DAMAGED":
      return "Dañado";
    case "LOST":
      return "Perdido";
    case "DELIVERED":
      return "Entregado";
    case "AVAILABLE":
      return "Disponible";
    case "INACTIVE":
      return "Inactivo";
    default:
      return status;
  }
}

function joinItemNames(
  items: Array<{
    nameSnap: string;
    quantity: number | null;
  }>
) {
  const labels = items
    .map((item) => {
      const qty = Number(item.quantity ?? 0);
      return qty > 1 ? `${item.nameSnap} x${qty}` : item.nameSnap;
    })
    .filter(Boolean);

  if (labels.length <= 2) return labels.join(" | ");
  return `${labels.slice(0, 2).join(" | ")} | +${labels.length - 2} más`;
}

export async function GET() {
  const session = await requireOpsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tz = process.env.BUSINESS_TZ || "Europe/Madrid";
  const now = new Date();
  const { start, endExclusive } = tzDayRangeUtc(tz, now);

  const rowsDb = await prisma.reservation.findMany({
    where: {
      status: { in: ["WAITING", "READY_FOR_PLATFORM", "IN_SEA", "SCHEDULED"] },
      OR: [
        { scheduledTime: { gte: start, lt: endExclusive } },
        { scheduledTime: null, activityDate: { gte: start, lt: endExclusive } },
      ],
    },
    orderBy: [{ scheduledTime: "asc" }, { activityDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,

      status: true,
      formalizedAt: true,
      activityDate: true,
      scheduledTime: true,

      customerName: true,
      customerCountry: true,
      companionsCount: true,

      quantity: true,
      pax: true,
      basePriceCents: true,
      totalPriceCents: true,
      depositCents: true,
      isLicense: true,
      autoDiscountCents: true,
      manualDiscountCents: true,
      manualDiscountReason: true,

      isPackParent: true,
      packId: true,

      source: true,
      boothCode: true,
      arrivedStoreAt: true,

      taxiboatTripId: true,
      taxiboatAssignedAt: true,
      taxiboatTrip: {
        select: {
          boat: true,
          tripNo: true,
          departedAt: true,
        },
      },

      channel: { select: { name: true } },
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },

      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          pax: true,
          unitPriceCents: true,
          totalPriceCents: true,
          isExtra: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
      },

      extraTimeEvents: {
        where: { status: "PENDING" },
        select: { id: true },
      },

      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          amountCents: true,
          isDeposit: true,
          direction: true,
          method: true,
          origin: true,
          createdAt: true,
        },
      },

      contracts: {
        select: { status: true, unitIndex: true },
      },

      depositHeld: true,
      depositHoldReason: true,
    },
  });

  const [barPendingTasksDb, barReturnTasksDb, barIncidentAssetsDb] = await Promise.all([
    prisma.fulfillmentTask.findMany({
      where: {
        area: "BAR",
        status: "PENDING",
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        title: true,
        customerNameSnap: true,
        paid: true,
        paidAmountCents: true,
        scheduledFor: true,
        createdAt: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            nameSnap: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.fulfillmentTask.findMany({
      where: {
        area: "BAR",
        type: "EXTRA_DELIVERY",
        status: "DELIVERED",
      },
      orderBy: [{ deliveredAt: "asc" }, { scheduledFor: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        customerNameSnap: true,
        paid: true,
        paidAmountCents: true,
        scheduledFor: true,
        deliveredAt: true,
        createdAt: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            nameSnap: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.rentalAsset.findMany({
      where: {
        isActive: true,
        status: { in: ["MAINTENANCE", "DAMAGED", "LOST"] },
      },
      orderBy: [{ status: "asc" }, { type: "asc" }, { code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        size: true,
        status: true,
        notes: true,
        updatedAt: true,
        assignments: {
          where: { returnedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            assignedAt: true,
            task: {
              select: {
                customerNameSnap: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const rows = rowsDb.map((r) => {
    const scheduledBase = r.scheduledTime ?? r.activityDate ?? null;
    const minsToStart = scheduledBase ? minutesDiff(now, scheduledBase) : null;

    const paidCents = r.payments.reduce((sum, p) => {
      const sign = p.direction === "OUT" ? -1 : 1;
      return sum + sign * p.amountCents;
    }, 0);

    const paidServiceCents = r.payments
      .filter((p) => !p.isDeposit)
      .reduce((sum, p) => {
        const sign = p.direction === "OUT" ? -1 : 1;
        return sum + sign * p.amountCents;
      }, 0);

    const paidDepositCents = r.payments
      .filter((p) => p.isDeposit)
      .reduce((sum, p) => {
        const sign = p.direction === "OUT" ? -1 : 1;
        return sum + sign * p.amountCents;
      }, 0);

    const refundableDepositCents = Math.max(0, paidDepositCents);

    const mainItem = r.items.find((it) => !it.isExtra) ?? null;
    const extras = r.items.filter((it) => it.isExtra);

    const serviceTotalCents = r.items
      .filter((it) => !it.isExtra)
      .reduce((sum, it) => sum + (it.totalPriceCents ?? 0), 0);

    const extrasTotalCents = r.items
      .filter((it) => it.isExtra)
      .reduce((sum, it) => sum + (it.totalPriceCents ?? 0), 0);

    const autoDisc = Number(r.autoDiscountCents ?? 0);
    const manualDisc = Number(r.manualDiscountCents ?? 0);

    const isPack = Boolean(r.isPackParent && r.packId);

    const grossCents = isPack
      ? Number(r.totalPriceCents ?? 0)
      : (r.items.length > 0
          ? serviceTotalCents + extrasTotalCents
          : Number(r.totalPriceCents ?? 0));

    const soldTotalCents = isPack
      ? Number(r.totalPriceCents ?? 0)
      : Math.max(0, grossCents - autoDisc - manualDisc);

    const pendingServiceCents = Math.max(0, soldTotalCents - paidServiceCents);
    const pendingDepositCents = Math.max(0, (r.depositCents ?? 0) - refundableDepositCents);
    const pendingCents = pendingServiceCents + pendingDepositCents;

    const requiredUnits = computeRequiredContractUnits({
      quantity: r.quantity,
      isLicense: Boolean(r.isLicense),
      serviceCategory: r.service?.category ?? null,
      items: (r.items ?? []).map((it) => ({
        quantity: it.quantity ?? 0,
        isExtra: Boolean(it.isExtra),
        service: it.service ? { category: it.service.category ?? null } : null,
      })),
    });

    const readyCount = (r.contracts ?? []).filter(
      (c) =>
        Number(c.unitIndex) >= 1 &&
        Number(c.unitIndex) <= requiredUnits &&
        (c.status === "READY" || c.status === "SIGNED")
    ).length;

    const contractsBadge =
      requiredUnits > 0 ? { requiredUnits, readyCount } : null;

    let depositStatus: "PENDIENTE" | "LIBERABLE" | "DEVUELTA" | "RETENIDA";
    if (r.depositHeld) {
      depositStatus = "RETENIDA";
    } else if (paidDepositCents <= 0) {
      const hadDepositIn = r.payments.some((p) => p.isDeposit && p.direction === "IN");
      const hadDepositOut = r.payments.some((p) => p.isDeposit && p.direction === "OUT");
      depositStatus = hadDepositIn && hadDepositOut ? "DEVUELTA" : "PENDIENTE";
    } else {
      depositStatus = "LIBERABLE";
    }

    const legacyServiceName = r.service?.name ?? null;
    const legacyDurationMinutes = r.option?.durationMinutes ?? null;

    const serviceName = isPack
      ? legacyServiceName
      : (mainItem?.service?.name ?? legacyServiceName);

    const durationMinutes = isPack
      ? null
      : (mainItem?.option?.durationMinutes ?? legacyDurationMinutes);

    let bucket: "pending" | "upcoming" | "ready" | "inSea" | "completed" = "pending";

    if (r.status === "IN_SEA") bucket = "inSea";
    else if (r.status === "READY_FOR_PLATFORM") bucket = "ready";
    else if (r.status === "SCHEDULED") bucket = "upcoming";
    else if (r.status === "WAITING") bucket = "pending";

    const waitingTooLong =
      r.status === "WAITING" && minutesDiff(r.createdAt, now) > 30;

    const missingAssignment =
      (r.status === "READY_FOR_PLATFORM" || r.status === "SCHEDULED") &&
      !r.taxiboatTripId &&
      !r.taxiboatAssignedAt;

    const unformalized = !r.formalizedAt;

    const contractsIncomplete =
      contractsBadge ? contractsBadge.readyCount < contractsBadge.requiredUnits : false;

    const platformExtrasPendingCount = r.extraTimeEvents?.length ?? 0;

    const startingSoon = minsToStart !== null && minsToStart <= 60 && minsToStart >= 0;
    const overdueStart = minsToStart !== null && minsToStart < 0;

    const notReadyEnough =
      ["WAITING", "SCHEDULED"].includes(r.status);

    const criticalPendingPayment =
      pendingCents > 0 && minsToStart !== null && minsToStart <= 60;

    const criticalContractsIncomplete =
      contractsIncomplete && minsToStart !== null && minsToStart <= 60;

    const taxiboatBlocked =
      !!r.taxiboatTripId &&
      !r.taxiboatTrip?.departedAt &&
      minsToStart !== null &&
      minsToStart <= 60;

    const overdueOperation =
      overdueStart &&
      r.status !== "IN_SEA";

    return {
      id: r.id,
      bucket,

      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
      activityDate: r.activityDate?.toISOString() ?? null,
      scheduledTime: r.scheduledTime?.toISOString() ?? null,
      formalizedAt: r.formalizedAt?.toISOString() ?? null,

      customerName: r.customerName ?? "Sin nombre",
      customerCountry: r.customerCountry ?? null,
      companionsCount: r.companionsCount ?? 0,

      serviceName,
      durationMinutes,
      channelName: r.channel?.name ?? null,

      source: r.source,
      boothCode: r.boothCode ?? null,
      arrivedStoreAt: r.arrivedStoreAt?.toISOString?.() ?? null,

      taxiboatTripId: r.taxiboatTripId,
      taxiboatBoat: r.taxiboatTrip?.boat ?? null,
      taxiboatTripNo: r.taxiboatTrip?.tripNo ?? null,
      taxiboatDepartedAt: r.taxiboatTrip?.departedAt?.toISOString?.() ?? null,

      status: r.status,
      minsToStart,

      soldTotalCents,
      pendingCents,
      pendingServiceCents,
      pendingDepositCents,
      paidCents,

      depositStatus,
      depositHeld: r.depositHeld,
      depositHoldReason: r.depositHoldReason ?? null,

      contractsBadge,
      contractsIncomplete,
      platformExtrasPendingCount,
      
      startingSoon,
      overdueStart,
      notReadyEnough,
      criticalPendingPayment,
      criticalContractsIncomplete,
      taxiboatBlocked,
      overdueOperation,

      waitingTooLong,
      missingAssignment,
      unformalized,

      notes: r.manualDiscountReason ?? null,
      detailHref: `/store/create?editFrom=${r.id}`,

      items: r.items.map((it) => ({
        id: it.id,
        isExtra: it.isExtra,
        serviceName: it.service?.name ?? null,
        quantity: it.quantity,
        pax: it.pax,
        durationMinutes: it.option?.durationMinutes ?? null,
        totalPriceCents: it.totalPriceCents,
      })),

      extras: extras.map((it) => ({
        id: it.id,
        serviceName: it.service?.name ?? null,
        quantity: it.quantity,
        pax: it.pax,
        totalPriceCents: it.totalPriceCents,
      })),
    };
  });

  const barPendingDeliveries = barPendingTasksDb.map((task) => {
    const serviceName = joinItemNames(
      task.items.map((item) => ({
        nameSnap: item.nameSnap,
        quantity:
          item.quantity == null
            ? null
            : typeof item.quantity === "number"
              ? item.quantity
              : item.quantity.toNumber(),
      }))
    );
    const scheduledIso = task.scheduledFor?.toISOString?.() ?? null;
    const baseTime = task.scheduledFor ?? task.createdAt;

    return {
      id: task.id,
      bucket: "pending" as const,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.createdAt.toISOString(),
      activityDate: scheduledIso,
      scheduledTime: scheduledIso,
      formalizedAt: task.createdAt.toISOString(),
      customerName: task.customerNameSnap ?? "Sin cliente",
      customerCountry: null,
      companionsCount: 0,
      serviceName: serviceName || (task.type === "CATERING" ? "Catering" : "Extra"),
      durationMinutes: null,
      channelName: null,
      source: "BAR",
      boothCode: null,
      arrivedStoreAt: null,
      taxiboatTripId: null,
      taxiboatBoat: null,
      taxiboatTripNo: null,
      taxiboatDepartedAt: null,
      status: task.type === "CATERING" ? "CATERING" : "PENDIENTE",
      minsToStart: task.scheduledFor ? minutesDiff(now, task.scheduledFor) : null,
      soldTotalCents: Number(task.paidAmountCents ?? 0),
      pendingCents: task.paid ? 0 : Number(task.paidAmountCents ?? 0),
      pendingServiceCents: task.paid ? 0 : Number(task.paidAmountCents ?? 0),
      pendingDepositCents: 0,
      paidCents: task.paid ? Number(task.paidAmountCents ?? 0) : 0,
      depositStatus: "PENDIENTE" as const,
      depositHeld: false,
      depositHoldReason: null,
      contractsBadge: null,
      contractsIncomplete: false,
      platformExtrasPendingCount: 0,
      startingSoon: task.scheduledFor ? minutesDiff(now, task.scheduledFor) <= 60 && minutesDiff(now, task.scheduledFor) >= 0 : false,
      overdueStart: task.scheduledFor ? minutesDiff(now, task.scheduledFor) < 0 : false,
      notReadyEnough: false,
      criticalPendingPayment: !task.paid && Number(task.paidAmountCents ?? 0) > 0,
      criticalContractsIncomplete: false,
      taxiboatBlocked: false,
      overdueOperation: false,
      waitingTooLong: baseTime ? minutesDiff(baseTime, now) > 30 : false,
      missingAssignment: false,
      unformalized: false,
      notes: task.title,
      detailHref: "/bar",
      items: [],
      extras: [],
    };
  });

  const barPendingReturns = barReturnTasksDb.map((task) => {
    const serviceName = joinItemNames(
      task.items.map((item) => ({
        nameSnap: item.nameSnap,
        quantity:
          item.quantity == null
            ? null
            : typeof item.quantity === "number"
              ? item.quantity
              : item.quantity.toNumber(),
      }))
    );
    const scheduledIso = task.scheduledFor?.toISOString?.() ?? null;
    const deliveredIso = task.deliveredAt?.toISOString?.() ?? task.createdAt.toISOString();

    return {
      id: task.id,
      bucket: "pending" as const,
      createdAt: task.createdAt.toISOString(),
      updatedAt: deliveredIso,
      activityDate: scheduledIso,
      scheduledTime: scheduledIso,
      formalizedAt: task.createdAt.toISOString(),
      customerName: task.customerNameSnap ?? "Sin cliente",
      customerCountry: null,
      companionsCount: 0,
      serviceName: serviceName || "Extra entregado",
      durationMinutes: null,
      channelName: null,
      source: "BAR",
      boothCode: null,
      arrivedStoreAt: null,
      taxiboatTripId: null,
      taxiboatBoat: null,
      taxiboatTripNo: null,
      taxiboatDepartedAt: null,
      status: "PENDIENTE DEVOLUCIÓN",
      minsToStart: null,
      soldTotalCents: Number(task.paidAmountCents ?? 0),
      pendingCents: 0,
      pendingServiceCents: 0,
      pendingDepositCents: 0,
      paidCents: task.paid ? Number(task.paidAmountCents ?? 0) : 0,
      depositStatus: "PENDIENTE" as const,
      depositHeld: false,
      depositHoldReason: null,
      contractsBadge: null,
      contractsIncomplete: false,
      platformExtrasPendingCount: 0,
      startingSoon: false,
      overdueStart: false,
      notReadyEnough: false,
      criticalPendingPayment: false,
      criticalContractsIncomplete: false,
      taxiboatBlocked: false,
      overdueOperation: false,
      waitingTooLong: false,
      missingAssignment: false,
      unformalized: false,
      notes: task.title,
      detailHref: "/bar",
      items: [],
      extras: [],
    };
  });

  const barIncidents = barIncidentAssetsDb.map((asset) => {
    const activeAssignment = asset.assignments[0] ?? null;
    const customerName = asset.code ? `${asset.name} · ${asset.code}` : asset.name;
    const serviceName = activeAssignment?.task.customerNameSnap
      ? `Asignado a ${activeAssignment.task.customerNameSnap}`
      : `${asset.type}${asset.size ? ` · ${asset.size}` : ""}`;

    return {
      id: asset.id,
      bucket: "pending" as const,
      createdAt: asset.updatedAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      activityDate: activeAssignment?.assignedAt?.toISOString?.() ?? null,
      scheduledTime: null,
      formalizedAt: asset.updatedAt.toISOString(),
      customerName,
      customerCountry: null,
      companionsCount: 0,
      serviceName,
      durationMinutes: null,
      channelName: null,
      source: "BAR",
      boothCode: null,
      arrivedStoreAt: null,
      taxiboatTripId: null,
      taxiboatBoat: null,
      taxiboatTripNo: null,
      taxiboatDepartedAt: null,
      status: labelRentalAssetStatus(asset.status),
      minsToStart: null,
      soldTotalCents: 0,
      pendingCents: 0,
      pendingServiceCents: 0,
      pendingDepositCents: 0,
      paidCents: 0,
      depositStatus: "PENDIENTE" as const,
      depositHeld: false,
      depositHoldReason: null,
      contractsBadge: null,
      contractsIncomplete: false,
      platformExtrasPendingCount: 0,
      startingSoon: false,
      overdueStart: false,
      notReadyEnough: false,
      criticalPendingPayment: false,
      criticalContractsIncomplete: false,
      taxiboatBlocked: false,
      overdueOperation: asset.status === "LOST" || asset.status === "DAMAGED",
      waitingTooLong: false,
      missingAssignment: false,
      unformalized: false,
      notes: asset.notes ?? null,
      detailHref: "/bar",
      items: [],
      extras: [],
    };
  });

  const pending = rows.filter((r) => r.bucket === "pending");
  const upcoming = rows.filter((r) => r.bucket === "upcoming");
  const ready = rows.filter((r) => r.bucket === "ready");
  const inSea = rows.filter((r) => r.bucket === "inSea");
  const completed: typeof rows = [];

  const alerts = {
    unformalized: rows.filter((r) => r.unformalized),

    waitingTooLong: rows.filter((r) => r.waitingTooLong),

    missingAssignment: rows.filter((r) => r.missingAssignment),

    completeOrSaturated: rows
      .filter((r) => r.contractsIncomplete || r.platformExtrasPendingCount > 0)
      .map((r) => ({
        reservationId: r.id,
        customerName: r.customerName,
        serviceName: r.serviceName,
        message: r.contractsIncomplete
          ? "Contratos incompletos"
          : "Extras de plataforma pendientes",
      })),

    pendingPayments: rows.filter((r) => r.pendingCents > 0),

    startingSoonNotReady: rows.filter(
      (r) => r.startingSoon && r.notReadyEnough
    ),

    overdueOperations: rows.filter((r) => r.overdueOperation),

    criticalPendingPayments: rows.filter((r) => r.criticalPendingPayment),

    criticalContracts: rows.filter((r) => r.criticalContractsIncomplete),

    taxiboatBlocked: rows.filter((r) => r.taxiboatBlocked),
  };

  const serviceWindowMap = new Map<
    string,
    {
      serviceName: string | null;
      count: number;
      reservations: Array<{
        id: string;
        customerName: string;
        scheduledTime: string | null;
        status: string | null;
      }>;
    }
  >();

  for (const r of rows) {
    const slotKey = `${r.serviceName ?? "Servicio"}__${r.scheduledTime ? r.scheduledTime.slice(0, 13) : "sin-hora"}`;
    if (!serviceWindowMap.has(slotKey)) {
      serviceWindowMap.set(slotKey, {
        serviceName: r.serviceName,
        count: 0,
        reservations: [],
      });
    }
    const entry = serviceWindowMap.get(slotKey)!;
    entry.count += 1;
    entry.reservations.push({
      id: r.id,
      customerName: r.customerName,
      scheduledTime: r.scheduledTime,
      status: r.status,
    });
  }

  const saturation = Array.from(serviceWindowMap.values())
    .filter((x) => x.count >= 4)
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    ok: true,
    businessDate: start.toISOString(),
    summary: {
      totalToday: rows.length,
      pending: pending.length,
      upcoming: upcoming.length,
      ready: ready.length,
      inSea: inSea.length,
      completed: completed.length,
      incidentsOpen: 0,
      saturationWarnings: alerts.completeOrSaturated.length,
      pendingPayments: alerts.pendingPayments.length,
      unformalized: alerts.unformalized.length,
      criticalAlerts:
        alerts.startingSoonNotReady.length +
        alerts.overdueOperations.length +
        alerts.criticalPendingPayments.length +
        alerts.criticalContracts.length +
        alerts.taxiboatBlocked.length,
    },
    alerts,
    saturation,
    board: {
      pending,
      upcoming,
      ready,
      inSea,
      completed,
    },
    areas: {
      booth: {
        pendingArrivalToStore: rows.filter(
          (r) => r.source === "BOOTH" && !r.arrivedStoreAt
        ),
        arrivedToStore: rows.filter(
          (r) => r.source === "BOOTH" && !!r.arrivedStoreAt
        ),
        taxiboatPendingDeparture: rows.filter(
          (r) => !!r.taxiboatTripId && !r.taxiboatDepartedAt
        ),
      },
      store: {
        unformalized: rows.filter((r) => r.unformalized),
        pendingPayments: rows.filter((r) => r.pendingCents > 0),
        incompleteContracts: rows.filter((r) => r.contractsIncomplete),
      },
      platform: {
        ready: rows.filter((r) => r.status === "READY_FOR_PLATFORM"),
        inSea: rows.filter((r) => r.status === "IN_SEA"),
        extrasPending: rows.filter((r) => r.platformExtrasPendingCount > 0),
      },
      bar: {
        pendingDeliveries: barPendingDeliveries,
        pendingReturns: barPendingReturns,
        incidents: barIncidents,
      },
    },
  });
}
