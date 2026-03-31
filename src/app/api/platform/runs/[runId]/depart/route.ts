import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z, type ZodIssue } from "zod";
import { isOperableStatus, operabilityBlockingReason } from "@/lib/operability";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import {
  MonitorRunKind,
  MonitorRunStatus,
  RunAssignmentStatus,
  ReservationStatus,
  ReservationUnitStatus,
} from "@prisma/client";

export const runtime = "nodejs";

const Body = z
  .object({
    override: z.boolean().optional(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.override && !value.reason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "El motivo es obligatorio para forzar la salida.",
      });
    }
  });

function validationMessage(issues: ZodIssue[]) {
  const first = issues[0];
  return first?.message || "Body inválido";
}

function deriveReservationStatusFromUnits(
  units: Array<{ status: ReservationUnitStatus }>
): ReservationStatus {
  if (!units.length) return ReservationStatus.WAITING;

  const hasInSea = units.some((u) => u.status === ReservationUnitStatus.IN_SEA);
  const hasReady = units.some((u) => u.status === ReservationUnitStatus.READY_FOR_PLATFORM);
  const hasWaiting = units.some((u) => u.status === ReservationUnitStatus.WAITING);
  const allCompleted = units.every((u) => u.status === ReservationUnitStatus.COMPLETED);
  const allCanceled = units.every((u) => u.status === ReservationUnitStatus.CANCELED);

  if (hasInSea) return ReservationStatus.IN_SEA;
  if (hasReady) return ReservationStatus.READY_FOR_PLATFORM;
  if (hasWaiting) return ReservationStatus.WAITING;
  if (allCompleted) return ReservationStatus.COMPLETED;
  if (allCanceled) return ReservationStatus.CANCELED;

  return ReservationStatus.WAITING;
}

function appendOverrideNote(runNote: string | null | undefined, text: string) {
  const base = runNote?.trim();
  return base ? `${base}\n${text}`.slice(0, 500) : text.slice(0, 500);
}

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { runId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: validationMessage(parsed.error.issues) }, { status: 400 });

  const override = Boolean(parsed.data.override);
  const reason = parsed.data.reason?.trim() || null;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRun" WHERE "id" = ${runId} FOR UPDATE`;

      const run = await tx.monitorRun.findUnique({
        where: { id: runId },
        select: { id: true, status: true, kind: true, monitorAssetId: true, note: true },
      });
      if (!run) throw new Error("Run no existe");
      if (run.status === MonitorRunStatus.CLOSED) throw new Error("La salida está cerrada");
      if (run.status === MonitorRunStatus.IN_SEA) return { ok: true, already: true };

      if (run.kind === MonitorRunKind.NAUTICA && !run.monitorAssetId) {
        throw new Error("Salida Náutica sin recurso del monitor (monitorAssetId).");
      }

      const queued = await tx.monitorRunAssignment.findMany({
        where: { runId, status: RunAssignmentStatus.QUEUED },
        select: {
          id: true,
          reservationId: true,
          reservationUnitId: true,
          durationMinutesSnapshot: true,
          jetskiId: true,
          assetId: true,
        },
      });

      if (queued.length === 0) {
        throw new Error("No hay asignaciones pendientes (QUEUED) para iniciar la salida");
      }

      if (!override) {
        for (const assignment of queued) {
          if (assignment.jetskiId) {
            const jetski = await tx.jetski.findUnique({
              where: { id: assignment.jetskiId },
              select: {
                id: true,
                number: true,
                operabilityStatus: true,
              },
            });

            if (!jetski) {
              throw new Error("Una de las motos asignadas ya no existe");
            }

            if (!isOperableStatus(jetski.operabilityStatus)) {
              throw new Error(
                `No se puede iniciar la salida: la moto ${jetski.number} no está operativa. ` +
                  (operabilityBlockingReason(jetski.operabilityStatus) ?? "")
              );
            }
          }

          if (assignment.assetId) {
            const asset = await tx.asset.findUnique({
              where: { id: assignment.assetId },
              select: {
                id: true,
                name: true,
                operabilityStatus: true,
              },
            });

            if (!asset) {
              throw new Error("Uno de los recursos asignados ya no existe");
            }

            if (!isOperableStatus(asset.operabilityStatus)) {
              throw new Error(
                `No se puede iniciar la salida: el recurso ${asset.name} no está operativo. ` +
                  (operabilityBlockingReason(asset.operabilityStatus) ?? "")
              );
            }
          }
        }
      }

      const now = new Date();
      const overrideStamp = override
        ? `[OVERRIDE SALIDA ${now.toISOString()}] ${session.username || session.userId}: ${reason}`
        : null;

      await tx.monitorRun.update({
        where: { id: runId },
        data: {
          status: MonitorRunStatus.IN_SEA,
          startedAt: now,
          ...(overrideStamp
            ? { note: appendOverrideNote(run.note, overrideStamp) }
            : null),
        },
        select: { id: true },
      });

      if (overrideStamp && reason) {
        const audit = tx as typeof prisma;
        await audit.operationalOverrideLog.create({
          data: {
            targetType: "MONITOR_RUN",
            action: "FORCE_DEPART",
            targetId: run.id,
            reason,
            createdByUserId: session.userId,
            payloadJson: {
              previousStatus: run.status,
              nextStatus: MonitorRunStatus.IN_SEA,
              queuedAssignments: queued.length,
            },
          },
          select: { id: true },
        });
      }

      const touchedReservationIds = new Set<string>();

      for (const assignment of queued) {
        if (!assignment.reservationUnitId) {
          throw new Error("Assignment sin reservationUnitId (no debería pasar)");
        }

        const expectedEndAt = new Date(now.getTime() + assignment.durationMinutesSnapshot * 60_000);

        await tx.monitorRunAssignment.update({
          where: { id: assignment.id },
          data: {
            status: RunAssignmentStatus.ACTIVE,
            startedAt: now,
            expectedEndAt,
          },
          select: { id: true },
        });

        await tx.reservationUnit.update({
          where: { id: assignment.reservationUnitId },
          data: { status: ReservationUnitStatus.IN_SEA },
          select: { id: true },
        });

        touchedReservationIds.add(assignment.reservationId);
      }

      for (const reservationId of touchedReservationIds) {
        const units = await tx.reservationUnit.findMany({
          where: { reservationId },
          select: { status: true },
        });

        const newStatus = deriveReservationStatusFromUnits(units);

        await tx.reservation.update({
          where: { id: reservationId },
          data: {
            status: newStatus,
            departureAt: newStatus === ReservationStatus.IN_SEA ? now : undefined,
          },
          select: { id: true },
        });
      }

      return { ok: true, activated: queued.length, override };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
