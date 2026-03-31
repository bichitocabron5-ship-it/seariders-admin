import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type AppSession } from "@/lib/session";
import { MonitorRunStatus, RunAssignmentStatus, ReservationStatus } from "@prisma/client";

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

function minutesDiff(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));
}

function severityByOverage(overByMin: number) {
  if (overByMin >= 30) return "critical" as const;
  if (overByMin >= 10) return "warn" as const;
  return "info" as const;
}

export async function GET() {
  const session = await requireOpsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  const [readyReservations, openRuns, queuedAssignments] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: ReservationStatus.READY_FOR_PLATFORM,
        monitorRunAssignments: { none: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } } },
      },
      select: {
        id: true,
        customerName: true,
        readyForPlatformAt: true,
      },
      orderBy: { readyForPlatformAt: "asc" },
      take: 50,
    }),
    prisma.monitorRun.findMany({
      where: {
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
      },
      select: {
        id: true,
        kind: true,
        status: true,
        startedAt: true,
        note: true,
        monitor: { select: { name: true } },
        assignments: {
          where: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            expectedEndAt: true,
            reservation: { select: { customerName: true } },
          },
        },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.monitorRunAssignment.findMany({
      where: {
        status: RunAssignmentStatus.QUEUED,
        run: { status: MonitorRunStatus.READY },
      },
      select: {
        id: true,
        createdAt: true,
        runId: true,
        run: {
          select: {
            monitor: { select: { name: true } },
            kind: true,
          },
        },
        reservation: { select: { id: true, customerName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const staleReadyReservations = readyReservations
    .map((reservation) => {
      const reference = reservation.readyForPlatformAt ?? now;
      const waitedMin = minutesDiff(reference, now);
      const targetMin = 15;
      const overByMin = Math.max(0, waitedMin - targetMin);
      return {
        key: `reservation:${reservation.id}`,
        type: "force_ready_followup",
        severity: severityByOverage(overByMin),
        title: "READY sin asignación",
        subtitle: reservation.customerName || "Reserva",
        detail: `${waitedMin} min en READY sin salida ni monitor.`,
        href: `/operations?reservationId=${reservation.id}`,
        entityId: reservation.id,
        targetMin,
        waitedMin,
        overByMin,
      };
    })
    .filter((item) => item.waitedMin >= 15);

  const staleQueuedAssignments = queuedAssignments
    .map((assignment) => {
      const waitedMin = minutesDiff(assignment.createdAt, now);
      const targetMin = 10;
      const overByMin = Math.max(0, waitedMin - targetMin);
      return {
        key: `assignment:${assignment.id}`,
        type: "force_depart",
        severity: severityByOverage(overByMin),
        title: "Cliente asignado sin salir",
        subtitle: `${assignment.run.monitor?.name || "Monitor"} · ${assignment.reservation.customerName || "Cliente"}`,
        detail: `${waitedMin} min en cola asignada (${assignment.run.kind}).`,
        href: "/platform",
        entityId: assignment.runId,
        targetMin,
        waitedMin,
        overByMin,
      };
    })
    .filter((item) => item.waitedMin >= 10);

  const staleReadyRuns = openRuns
    .filter((run) => run.status === MonitorRunStatus.READY && run.assignments.length === 0)
    .map((run) => {
      const waitedMin = minutesDiff(run.startedAt, now);
      const targetMin = 20;
      const overByMin = Math.max(0, waitedMin - targetMin);
      return {
        key: `run-ready:${run.id}`,
        type: "close_run",
        severity: severityByOverage(overByMin),
        title: "Salida READY vacía",
        subtitle: run.monitor?.name || "Monitor",
        detail: `${waitedMin} min abierta sin clientes asignados.`,
        href: "/platform",
        entityId: run.id,
        targetMin,
        waitedMin,
        overByMin,
      };
    })
    .filter((item) => item.waitedMin >= 20);

  const overdueInSeaRuns = openRuns
    .filter((run) => run.status === MonitorRunStatus.IN_SEA)
    .flatMap((run) =>
      run.assignments
        .filter((assignment) => assignment.status === RunAssignmentStatus.ACTIVE && assignment.expectedEndAt)
        .map((assignment) => {
          const expectedEndAt = assignment.expectedEndAt ? new Date(assignment.expectedEndAt) : now;
          const overByMin = Math.max(0, minutesDiff(expectedEndAt, now));
          return {
            key: `run-overdue:${assignment.id}`,
            type: "close_run",
            severity: severityByOverage(overByMin),
            title: "Salida en mar fuera de tiempo",
            subtitle: `${run.monitor?.name || "Monitor"} · ${assignment.reservation.customerName || "Cliente"}`,
            detail: overByMin > 0 ? `${overByMin} min por encima del fin previsto.` : "Dentro de tiempo previsto.",
            href: "/platform",
            entityId: run.id,
            targetMin: 0,
            waitedMin: overByMin,
            overByMin,
          };
        })
        .filter((item) => item.overByMin > 0)
    );

  const items = [
    ...staleReadyReservations,
    ...staleQueuedAssignments,
    ...staleReadyRuns,
    ...overdueInSeaRuns,
  ].sort((a, b) => b.overByMin - a.overByMin);

  const summary = {
    total: items.length,
    critical: items.filter((item) => item.severity === "critical").length,
    warn: items.filter((item) => item.severity === "warn").length,
    info: items.filter((item) => item.severity === "info").length,
    readyWithoutAssignment: staleReadyReservations.length,
    queuedWithoutDeparture: staleQueuedAssignments.length,
    staleReadyRuns: staleReadyRuns.length,
    overdueInSeaRuns: overdueInSeaRuns.length,
  };

  return NextResponse.json({
    ok: true,
    generatedAt: now.toISOString(),
    summary,
    items: items.slice(0, 20),
  });
}
