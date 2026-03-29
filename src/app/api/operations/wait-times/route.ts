// src/app/api/operations/wait-times/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireOperationsAccess() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;

  if (["ADMIN", "STORE", "BOOTH", "PLATFORM"].includes(String(session.role))) {
    return session;
  }

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
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
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
    utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000);
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
    ymd: `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`,
  };
}

function diffMinutes(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function avg(nums: Array<number | null | undefined>) {
  const values = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

function max(nums: Array<number | null | undefined>) {
  const values = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (values.length === 0) return null;
  return Math.max(...values);
}

function pctWithin(values: Array<number | null | undefined>, targetMin: number) {
  const clean = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (clean.length === 0) return null;
  const ok = clean.filter((n) => n <= targetMin).length;
  return Math.round((ok / clean.length) * 100);
}

function roundOrNull(v: number | null) {
  return v == null ? null : Math.round(v);
}

const SLA = {
  boothAssignTaxiMin: 5,
  taxiDepartAfterAssignMin: 5,
  boothToStoreMin: 20,
  platformToBoothLiveMin: 10,

  storeQueueMin: 10,
  storeFormalizeMin: 12,
  storeFormalizeToPaymentMin: 10,
  storePaymentToReadyMin: 5,
  storeTotalToReadyMin: 20,

  platformQueueLiveMin: 15,
  platformUnitToAssignMin: 10,
  platformAssignToSeaMin: 8,

  seaDurationMin: 20,
  seaDelayMin: 5,
};

function boatLabel(boat: string) {
  if (boat === "TAXIBOAT_1") return "Taxiboat 1";
  if (boat === "TAXIBOAT_2") return "Taxiboat 2";
  return boat;
}

type ActiveWaitRow = {
  reservationId: string;
  label: string;
  phase: string;
  waitedMin: number;
  targetMin: number;
  overByMin: number;
  startedAt: string;
  scheduledTime: string | null;
};

export async function GET() {
  const session = await requireOperationsAccess();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const tz = process.env.BUSINESS_TZ || "Europe/Madrid";
  const today = tzDayRangeUtc(tz, now);

  const reservations = await prisma.reservation.findMany({
    where: {
      OR: [
        { scheduledTime: { gte: today.start, lt: today.endExclusive } },
        { scheduledTime: null, activityDate: { gte: today.start, lt: today.endExclusive } },
      ],
    },
    select: {
      id: true,
      customerName: true,
      activityDate: true,
      scheduledTime: true,

      boothCreatedAt: true,
      arrivedStoreAt: true,
      storeQueueStartedAt: true,
      formalizedAt: true,
      paymentCompletedAt: true,
      readyForPlatformAt: true,
      taxiboatAssignedAt: true,
      taxiboatTrip: {
        select: {
          departedAt: true,
        },
      },

      units: {
        select: {
          id: true,
          readyForPlatformAt: true,
        },
      },
    },
    orderBy: [{ scheduledTime: "asc" }, { activityDate: "asc" }],
  });

  const taxiboatOps = await prisma.taxiboatOperation.findMany({
    orderBy: { boat: "asc" },
    select: {
      boat: true,
      status: true,
      arrivedPlatformAt: true,
      departedPlatformAt: true,
      arrivedBoothAt: true,
      updatedAt: true,
    },
  });

  const reservationIds = reservations.map((r) => r.id);

  const assignments = reservationIds.length
    ? await prisma.monitorRunAssignment.findMany({
        where: {
          reservationUnit: {
            reservationId: { in: reservationIds },
          },
        },
        select: {
          id: true,
          createdAt: true,
          startedAt: true,
          expectedEndAt: true,
          endedAt: true,
          reservationUnit: {
            select: {
              id: true,
              reservationId: true,
              readyForPlatformAt: true,
            },
          },
          run: {
            select: {
              id: true,
              startedAt: true,
              endedAt: true,
              closedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const assignmentsByReservation = new Map<
    string,
    Array<{
      id: string;
      createdAt: Date;
      startedAt: Date | null;
      expectedEndAt: Date | null;
      endedAt: Date | null;
      reservationUnit: {
        id: string;
        reservationId: string;
        readyForPlatformAt: Date | null;
      } | null;
      run: {
        id: string;
        startedAt: Date | null;
        endedAt: Date | null;
        closedAt: Date | null;
      } | null;
    }>
  >();

  for (const a of assignments) {
    if (!a.reservationUnit) continue;
    const reservationId = a.reservationUnit.reservationId;
    if (!assignmentsByReservation.has(reservationId)) {
      assignmentsByReservation.set(reservationId, []);
    }
    assignmentsByReservation.get(reservationId)!.push(a);
  }

  const boothAssignTaxi = reservations.map((r) =>
    diffMinutes(r.boothCreatedAt, r.taxiboatAssignedAt)
  );

  const taxiAssignToDepart = reservations.map((r) => {
    const trip = { departedAt: r.taxiboatTrip?.departedAt ?? null };
    return diffMinutes(r.taxiboatAssignedAt, trip?.departedAt ?? null);
  });

  const boothToStoreTrip = reservations.map((r) => {
    const trip = { departedAt: r.taxiboatTrip?.departedAt ?? null };
    return diffMinutes(trip?.departedAt ?? null, r.arrivedStoreAt);
  });

  const boothToStoreTotal = reservations.map((r) =>
    diffMinutes(r.boothCreatedAt, r.arrivedStoreAt)
  );

  const storeQueue = reservations.map((r) =>
    diffMinutes(r.storeQueueStartedAt ?? r.arrivedStoreAt, r.formalizedAt)
  );

  const storeArrivedToFormalized = reservations.map((r) =>
    diffMinutes(r.arrivedStoreAt, r.formalizedAt)
  );

  const storeFormalizedToPayment = reservations.map((r) =>
    diffMinutes(r.formalizedAt, r.paymentCompletedAt)
  );

  const storePaymentToReady = reservations.map((r) =>
    diffMinutes(r.paymentCompletedAt, r.readyForPlatformAt)
  );

  const storeFormalizedToReady = reservations.map((r) =>
    diffMinutes(r.formalizedAt, r.readyForPlatformAt)
  );

  const platformToBoothLive = taxiboatOps
    .filter((row) => row.status === "TO_BOOTH")
    .map((row) => diffMinutes(row.departedPlatformAt ?? row.updatedAt, now));

  const platformToBoothCompleted = taxiboatOps
    .filter((row) => row.departedPlatformAt && row.arrivedBoothAt)
    .map((row) => diffMinutes(row.departedPlatformAt, row.arrivedBoothAt));

  const platformQueueLive: number[] = [];
  const platformUnitToAssign: Array<number | null> = [];
  const assignToSea: Array<number | null> = [];
  const seaDuration: Array<number | null> = [];
  const seaDelay: Array<number | null> = [];
  const runOpenDuration: Array<number | null> = [];

  for (const r of reservations) {
    const reservationAssignments = assignmentsByReservation.get(r.id) ?? [];

    for (const unit of r.units) {
      const unitAssignments = reservationAssignments.filter(
        (a) => a.reservationUnit?.id === unit.id
      );

      if (unit.readyForPlatformAt && unitAssignments.length === 0) {
        platformQueueLive.push(diffMinutes(unit.readyForPlatformAt, now) ?? 0);
      }

      const firstAssignment = unitAssignments[0];
      if (unit.readyForPlatformAt && firstAssignment?.createdAt) {
        platformUnitToAssign.push(
          diffMinutes(unit.readyForPlatformAt, firstAssignment.createdAt)
        );
      }
    }

    for (const a of reservationAssignments) {
      assignToSea.push(diffMinutes(a.createdAt, a.startedAt));
      seaDuration.push(diffMinutes(a.startedAt, a.endedAt));

      if (a.endedAt && a.expectedEndAt) {
        seaDelay.push(diffMinutes(a.expectedEndAt, a.endedAt));
      }

      const runEnd = a.run?.closedAt ?? a.run?.endedAt ?? null;
      if (a.run?.startedAt) {
        runOpenDuration.push(diffMinutes(a.run.startedAt, runEnd));
      }
    }
  }

  const activeRows: ActiveWaitRow[] = [];

  for (const r of reservations) {
    const label = r.customerName?.trim() || `Reserva ${r.id.slice(-6)}`;
    const scheduledTime = r.scheduledTime?.toISOString() ?? null;

    if (r.boothCreatedAt && !r.taxiboatAssignedAt) {
      const waitedMin = diffMinutes(r.boothCreatedAt, now) ?? 0;
      activeRows.push({
        reservationId: r.id,
        label,
        phase: "BOOTH | esperando taxi",
        waitedMin,
        targetMin: SLA.boothAssignTaxiMin,
        overByMin: Math.max(0, waitedMin - SLA.boothAssignTaxiMin),
        startedAt: r.boothCreatedAt.toISOString(),
        scheduledTime,
      });
    }

    if (r.arrivedStoreAt && !r.formalizedAt) {
      const started = r.storeQueueStartedAt ?? r.arrivedStoreAt;
      const waitedMin = diffMinutes(started, now) ?? 0;
      activeRows.push({
        reservationId: r.id,
        label,
        phase: "STORE | cola / atencion",
        waitedMin,
        targetMin: SLA.storeQueueMin,
        overByMin: Math.max(0, waitedMin - SLA.storeQueueMin),
        startedAt: started.toISOString(),
        scheduledTime,
      });
    }

    if (r.formalizedAt && !r.readyForPlatformAt) {
      const started = r.paymentCompletedAt ?? r.formalizedAt;
      const targetMin = r.paymentCompletedAt
        ? SLA.storePaymentToReadyMin
        : SLA.storeTotalToReadyMin;

      const waitedMin = diffMinutes(started, now) ?? 0;
      activeRows.push({
        reservationId: r.id,
        label,
        phase: r.paymentCompletedAt
          ? "STORE | cobrado pendiente de READY"
          : "STORE | formalizado pendiente de READY",
        waitedMin,
        targetMin,
        overByMin: Math.max(0, waitedMin - targetMin),
        startedAt: started.toISOString(),
        scheduledTime,
      });
    }

    for (const unit of r.units) {
      const reservationAssignments = assignmentsByReservation.get(r.id) ?? [];
      const unitAssignments = reservationAssignments.filter(
        (a) => a.reservationUnit?.id === unit.id
      );

      if (unit.readyForPlatformAt && unitAssignments.length === 0) {
        const waitedMin = diffMinutes(unit.readyForPlatformAt, now) ?? 0;
        activeRows.push({
          reservationId: r.id,
          label,
          phase: "PLATFORM | cola sin asignacion",
          waitedMin,
          targetMin: SLA.platformQueueLiveMin,
          overByMin: Math.max(0, waitedMin - SLA.platformQueueLiveMin),
          startedAt: unit.readyForPlatformAt.toISOString(),
          scheduledTime,
        });
      }

      for (const a of unitAssignments) {
        if (a.createdAt && !a.startedAt) {
          const waitedMin = diffMinutes(a.createdAt, now) ?? 0;
          activeRows.push({
            reservationId: r.id,
            label,
            phase: "PLATFORM | asignado sin salir al mar",
            waitedMin,
            targetMin: SLA.platformAssignToSeaMin,
            overByMin: Math.max(0, waitedMin - SLA.platformAssignToSeaMin),
            startedAt: a.createdAt.toISOString(),
            scheduledTime,
          });
        }
      }
    }
  }

  for (const op of taxiboatOps) {
    if (op.status !== "TO_BOOTH") continue;

    const startedAt = op.departedPlatformAt ?? op.updatedAt;
    const waitedMin = diffMinutes(startedAt, now) ?? 0;

    activeRows.push({
      reservationId: op.boat,
      label: boatLabel(op.boat),
      phase: "PLATFORM | retorno a Booth",
      waitedMin,
      targetMin: SLA.platformToBoothLiveMin,
      overByMin: Math.max(0, waitedMin - SLA.platformToBoothLiveMin),
      startedAt: startedAt.toISOString(),
      scheduledTime: null,
    });
  }

  activeRows.sort((a, b) => b.overByMin - a.overByMin || b.waitedMin - a.waitedMin);

  const phaseRows = [
    {
      phase: "Booth | asignacion taxi",
      avgMin: roundOrNull(avg(boothAssignTaxi)),
      maxMin: roundOrNull(max(boothAssignTaxi)),
      cases: boothAssignTaxi.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.boothAssignTaxiMin,
      slaOkPct: pctWithin(boothAssignTaxi, SLA.boothAssignTaxiMin),
    },
    {
      phase: "Taxi | asignado a salida",
      avgMin: roundOrNull(avg(taxiAssignToDepart)),
      maxMin: roundOrNull(max(taxiAssignToDepart)),
      cases: taxiAssignToDepart.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.taxiDepartAfterAssignMin,
      slaOkPct: pctWithin(taxiAssignToDepart, SLA.taxiDepartAfterAssignMin),
    },
    {
      phase: "Booth -> Store",
      avgMin: roundOrNull(avg(boothToStoreTotal)),
      maxMin: roundOrNull(max(boothToStoreTotal)),
      cases: boothToStoreTotal.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.boothToStoreMin,
      slaOkPct: pctWithin(boothToStoreTotal, SLA.boothToStoreMin),
    },
    {
      phase: "Platform | retorno a Booth",
      avgMin: roundOrNull(avg(platformToBoothCompleted)),
      maxMin: roundOrNull(max(platformToBoothCompleted)),
      cases: platformToBoothCompleted.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.platformToBoothLiveMin,
      slaOkPct: pctWithin(platformToBoothCompleted, SLA.platformToBoothLiveMin),
    },
    {
      phase: "Store | cola",
      avgMin: roundOrNull(avg(storeQueue)),
      maxMin: roundOrNull(max(storeQueue)),
      cases: storeQueue.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.storeQueueMin,
      slaOkPct: pctWithin(storeQueue, SLA.storeQueueMin),
    },
    {
      phase: "Store | llegada a formalizacion",
      avgMin: roundOrNull(avg(storeArrivedToFormalized)),
      maxMin: roundOrNull(max(storeArrivedToFormalized)),
      cases: storeArrivedToFormalized.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.storeFormalizeMin,
      slaOkPct: pctWithin(storeArrivedToFormalized, SLA.storeFormalizeMin),
    },
    {
      phase: "Store | formalizacion a cobro",
      avgMin: roundOrNull(avg(storeFormalizedToPayment)),
      maxMin: roundOrNull(max(storeFormalizedToPayment)),
      cases: storeFormalizedToPayment.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.storeFormalizeToPaymentMin,
      slaOkPct: pctWithin(storeFormalizedToPayment, SLA.storeFormalizeToPaymentMin),
    },
    {
      phase: "Store | cobro a ready",
      avgMin: roundOrNull(avg(storePaymentToReady)),
      maxMin: roundOrNull(max(storePaymentToReady)),
      cases: storePaymentToReady.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.storePaymentToReadyMin,
      slaOkPct: pctWithin(storePaymentToReady, SLA.storePaymentToReadyMin),
    },
    {
      phase: "Store | formalizacion a ready",
      avgMin: roundOrNull(avg(storeFormalizedToReady)),
      maxMin: roundOrNull(max(storeFormalizedToReady)),
      cases: storeFormalizedToReady.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.storeTotalToReadyMin,
      slaOkPct: pctWithin(storeFormalizedToReady, SLA.storeTotalToReadyMin),
    },
    {
      phase: "Platform | cola live",
      avgMin: roundOrNull(avg(platformQueueLive)),
      maxMin: roundOrNull(max(platformQueueLive)),
      cases: platformQueueLive.length,
      slaTargetMin: SLA.platformQueueLiveMin,
      slaOkPct: pctWithin(platformQueueLive, SLA.platformQueueLiveMin),
    },
    {
      phase: "Platform | unidad a asignacion",
      avgMin: roundOrNull(avg(platformUnitToAssign)),
      maxMin: roundOrNull(max(platformUnitToAssign)),
      cases: platformUnitToAssign.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.platformUnitToAssignMin,
      slaOkPct: pctWithin(platformUnitToAssign, SLA.platformUnitToAssignMin),
    },
    {
      phase: "Platform | asignacion a mar",
      avgMin: roundOrNull(avg(assignToSea)),
      maxMin: roundOrNull(max(assignToSea)),
      cases: assignToSea.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.platformAssignToSeaMin,
      slaOkPct: pctWithin(assignToSea, SLA.platformAssignToSeaMin),
    },
    {
      phase: "Servicio | duracion real",
      avgMin: roundOrNull(avg(seaDuration)),
      maxMin: roundOrNull(max(seaDuration)),
      cases: seaDuration.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.seaDurationMin,
      slaOkPct: pctWithin(seaDuration, SLA.seaDurationMin),
    },
    {
      phase: "Servicio | retraso",
      avgMin: roundOrNull(avg(seaDelay)),
      maxMin: roundOrNull(max(seaDelay)),
      cases: seaDelay.filter((v) => typeof v === "number").length,
      slaTargetMin: SLA.seaDelayMin,
      slaOkPct: pctWithin(seaDelay, SLA.seaDelayMin),
    },
  ];

  return NextResponse.json({
    ok: true,
    generatedAt: now.toISOString(),
    ymd: today.ymd,
    sla: SLA,

    summary: {
      boothAssignTaxiAvgMin: roundOrNull(avg(boothAssignTaxi)),
      taxiAssignToDepartAvgMin: roundOrNull(avg(taxiAssignToDepart)),
      boothToStoreTripAvgMin: roundOrNull(avg(boothToStoreTrip)),
      boothToStoreTotalAvgMin: roundOrNull(avg(boothToStoreTotal)),
      platformToBoothLiveAvgMin: roundOrNull(avg(platformToBoothCompleted)),

      storeQueueAvgMin: roundOrNull(avg(storeQueue)),
      storeArrivedToFormalizedAvgMin: roundOrNull(avg(storeArrivedToFormalized)),
      storeFormalizedToPaymentAvgMin: roundOrNull(avg(storeFormalizedToPayment)),
      storePaymentToReadyAvgMin: roundOrNull(avg(storePaymentToReady)),
      storeFormalizedToReadyAvgMin: roundOrNull(avg(storeFormalizedToReady)),

      platformQueueLiveAvgMin: roundOrNull(avg(platformQueueLive)),
      platformUnitToAssignAvgMin: roundOrNull(avg(platformUnitToAssign)),
      platformAssignToSeaAvgMin: roundOrNull(avg(assignToSea)),

      seaDurationAvgMin: roundOrNull(avg(seaDuration)),
      seaDelayAvgMin: roundOrNull(avg(seaDelay)),
      runOpenDurationAvgMin: roundOrNull(avg(runOpenDuration)),
    },

    counts: {
      reservations: reservations.length,
      unitsReadyForPlatformWithoutAssignment: platformQueueLive.length,
      activeAlerts: activeRows.filter((r) => r.overByMin > 0).length,
      assignments: assignments.length,
    },

    active: activeRows.slice(0, 20),

    phaseRows,
  });
}


