import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.operationalOverrideLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      targetType: true,
      action: true,
      targetId: true,
      reason: true,
      createdAt: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    },
  });

  const reservationIds = rows
    .filter((row) => row.targetType === "RESERVATION")
    .map((row) => row.targetId);
  const runIds = rows
    .filter((row) => row.targetType === "MONITOR_RUN")
    .map((row) => row.targetId);

  const [reservations, runs] = await Promise.all([
    reservationIds.length
      ? prisma.reservation.findMany({
          where: { id: { in: reservationIds } },
          select: {
            id: true,
            customerName: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    runIds.length
      ? prisma.monitorRun.findMany({
          where: { id: { in: runIds } },
          select: {
            id: true,
            kind: true,
            status: true,
            monitor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const reservationMap = new Map(
    reservations.map((reservation) => [reservation.id, reservation])
  );
  const runMap = new Map(
    runs.map((run) => [
      run.id,
      {
        id: run.id,
        kind: run.kind,
        status: run.status,
        monitorName: run.monitor?.name ?? null,
      },
    ])
  );

  return NextResponse.json({
    ok: true,
    rows: rows.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      action: row.action,
      targetId: row.targetId,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdByUser
        ? {
            id: row.createdByUser.id,
            username: row.createdByUser.username,
            fullName: row.createdByUser.fullName,
          }
        : null,
      reservation: row.targetType === "RESERVATION" ? reservationMap.get(row.targetId) ?? null : null,
      run: row.targetType === "MONITOR_RUN" ? runMap.get(row.targetId) ?? null : null,
    })),
  });
}
