import { NextResponse } from "next/server";
import { ExtraTimeStatus, MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { z } from "zod";

import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";
import { prisma } from "@/lib/prisma";
import { getPlatformExtraByServiceCodeTx } from "@/lib/platform-extras";
import { applyPlatformExtraEventsTx } from "@/lib/reservation-platform-extras";

export const runtime = "nodejs";

const Body = z.object({
  serviceCode: z.string().trim().min(1),
  extraMinutes: z.number().int().min(5).max(240).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ assignmentId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { assignmentId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const body = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRunAssignment" WHERE "id" = ${assignmentId} FOR UPDATE`;

      const assignment = await tx.monitorRunAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,
          reservationId: true,
          runId: true,
          jetskiId: true,
          reservationUnitId: true,
          run: {
            select: {
              id: true,
              status: true,
              kind: true,
            },
          },
        },
      });

      if (!assignment) throw new Error("Assignment no existe");
      if (assignment.status !== RunAssignmentStatus.ACTIVE) {
        throw new Error(`Solo se puede extender si está ACTIVE (ahora: ${assignment.status})`);
      }
      if (
        assignment.run.status !== MonitorRunStatus.READY &&
        assignment.run.status !== MonitorRunStatus.IN_SEA
      ) {
        throw new Error(`La salida no está abierta (${assignment.run.status})`);
      }

      const catalogExtra = await getPlatformExtraByServiceCodeTx(tx, body.serviceCode);
      if (!catalogExtra) {
        throw new Error(`El extra ${body.serviceCode} no existe en catálogo o no está normalizado para Platform`);
      }

      const expectedTarget = assignment.run.kind === "JETSKI" ? "JETSKI" : "BOAT";
      if (catalogExtra.target !== expectedTarget) {
        throw new Error(`El extra ${catalogExtra.serviceCode} no es válido para ${assignment.run.kind}`);
      }

      const extraMinutes = Number(body.extraMinutes ?? catalogExtra.extraMinutes);
      if (extraMinutes !== Number(catalogExtra.extraMinutes)) {
        throw new Error(`El catálogo define ${catalogExtra.extraMinutes} min para ${catalogExtra.serviceCode}`);
      }

      if (!assignment.expectedEndAt && !assignment.startedAt) {
        throw new Error("Assignment sin startedAt");
      }

      const baseExpected =
        assignment.expectedEndAt ??
        new Date(
          assignment.startedAt!.getTime() +
            Number(assignment.durationMinutesSnapshot ?? 0) * 60_000
        );
      const newExpected = new Date(baseExpected.getTime() + extraMinutes * 60_000);

      const updated = await tx.monitorRunAssignment.update({
        where: { id: assignment.id },
        data: {
          expectedEndAt: newExpected,
          durationMinutesSnapshot: Number(assignment.durationMinutesSnapshot ?? 0) + extraMinutes,
        },
        select: {
          id: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,
        },
      });

      const event = await tx.extraTimeEvent.create({
        data: {
          reservationId: assignment.reservationId,
          assignmentId: assignment.id,
          runId: assignment.runId,
          jetskiId: assignment.jetskiId!,
          reservationUnitId: assignment.reservationUnitId ?? null,
          serviceCode: catalogExtra.serviceCode,
          extraMinutes,
          status: ExtraTimeStatus.PENDING,
          createdByUserId: session.userId!,
        },
        select: { id: true },
      });

      await applyPlatformExtraEventsTx(tx, assignment.reservationId, [event.id]);

      return {
        ok: true,
        assignmentId: updated.id,
        expectedEndAt: updated.expectedEndAt,
        durationMinutesSnapshot: updated.durationMinutesSnapshot,
      };
    });

    return NextResponse.json(out);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
