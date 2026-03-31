import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z, type ZodIssue } from "zod";
import {
  MonitorRunStatus,
  RunAssignmentStatus,
  ReservationStatus,
  ReservationUnitStatus,
} from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Body = z
  .object({
    endedAt: z.string().datetime().optional().nullable(),
    override: z.boolean().optional(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.override && !value.reason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "El motivo es obligatorio para cerrar manualmente.",
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

  if (units.some((unit) => unit.status === ReservationUnitStatus.IN_SEA)) {
    return ReservationStatus.IN_SEA;
  }
  if (units.some((unit) => unit.status === ReservationUnitStatus.READY_FOR_PLATFORM)) {
    return ReservationStatus.READY_FOR_PLATFORM;
  }
  if (units.some((unit) => unit.status === ReservationUnitStatus.WAITING)) {
    return ReservationStatus.WAITING;
  }
  if (units.every((unit) => unit.status === ReservationUnitStatus.COMPLETED)) {
    return ReservationStatus.COMPLETED;
  }
  if (units.every((unit) => unit.status === ReservationUnitStatus.CANCELED)) {
    return ReservationStatus.CANCELED;
  }

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
  if (!parsed.success) return new NextResponse(validationMessage(parsed.error.issues), { status: 400 });

  const endedAt = parsed.data.endedAt ? new Date(parsed.data.endedAt) : new Date();
  const override = Boolean(parsed.data.override);
  const reason = parsed.data.reason?.trim() || null;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRun" WHERE "id" = ${runId} FOR UPDATE`;

      const run = await tx.monitorRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          status: true,
          endedAt: true,
          closedAt: true,
          note: true,
          assignments: {
            select: {
              id: true,
              status: true,
              reservationId: true,
              reservationUnitId: true,
            },
          },
        },
      });
      if (!run) throw new Error("Run no existe");

      if (run.status === MonitorRunStatus.CLOSED) {
        return { ok: true, runId: run.id, alreadyClosed: true };
      }

      if (![MonitorRunStatus.READY, MonitorRunStatus.IN_SEA].includes(run.status)) {
        throw new Error(`No se puede cerrar en estado ${run.status}`);
      }

      const activeOrQueued = (run.assignments ?? []).filter(
        (assignment) =>
          assignment.status === RunAssignmentStatus.ACTIVE ||
          assignment.status === RunAssignmentStatus.QUEUED
      );

      if (activeOrQueued.length > 0 && !override) {
        return NextResponse.json(
          { error: "No se puede cerrar: hay assignments ACTIVE/QUEUED", activeOrQueuedCount: activeOrQueued.length },
          { status: 409 }
        );
      }

      if (activeOrQueued.length > 0 && override) {
        const touchedReservationIds = new Set<string>();

        for (const assignment of activeOrQueued) {
          await tx.monitorRunAssignment.update({
            where: { id: assignment.id },
            data: {
              status: RunAssignmentStatus.FINISHED,
              endedAt,
            },
            select: { id: true },
          });

          if (assignment.reservationUnitId) {
            await tx.reservationUnit.update({
              where: { id: assignment.reservationUnitId },
              data: { status: ReservationUnitStatus.WAITING },
              select: { id: true },
            });
          }

          touchedReservationIds.add(assignment.reservationId);
        }

        for (const reservationId of touchedReservationIds) {
          const units = await tx.reservationUnit.findMany({
            where: { reservationId },
            select: { status: true },
          });

          const nextStatus = deriveReservationStatusFromUnits(units);

          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              status: nextStatus,
              arrivalAt:
                nextStatus === ReservationStatus.WAITING ||
                nextStatus === ReservationStatus.COMPLETED
                  ? endedAt
                  : undefined,
            },
            select: { id: true },
          });
        }
      }

      const overrideStamp = override
        ? `[OVERRIDE CIERRE ${endedAt.toISOString()}] ${session.username || session.userId}: ${reason}`
        : null;

      const updated = await tx.monitorRun.update({
        where: { id: runId },
        data: {
          status: MonitorRunStatus.CLOSED,
          closedAt: endedAt,
          endedAt,
          ...(overrideStamp ? { note: appendOverrideNote(run.note, overrideStamp) } : null),
        },
        select: { id: true, status: true, closedAt: true, endedAt: true, note: true },
      });

      if (overrideStamp && reason) {
        const audit = tx as typeof prisma;
        await audit.operationalOverrideLog.create({
          data: {
            targetType: "MONITOR_RUN",
            action: "FORCE_CLOSE_RUN",
            targetId: run.id,
            reason,
            createdByUserId: session.userId,
            payloadJson: {
              previousStatus: run.status,
              nextStatus: MonitorRunStatus.CLOSED,
              activeOrQueuedAssignments: activeOrQueued.length,
            },
          },
          select: { id: true },
        });
      }

      return { ok: true, run: updated, override };
    });

    if (out instanceof NextResponse) return out;

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
