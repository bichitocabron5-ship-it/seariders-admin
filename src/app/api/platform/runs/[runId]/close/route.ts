import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { runId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const endedAt =
    json && typeof json === "object" && "endedAt" in json && typeof json.endedAt === "string"
      ? new Date(json.endedAt)
      : new Date();

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRun" WHERE "id" = ${runId} FOR UPDATE`;

      const run = await tx.monitorRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          status: true,
          assignments: {
            select: {
              id: true,
              status: true,
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

      if (activeOrQueued.length > 0) {
        return NextResponse.json(
          { error: "No se puede cerrar: hay assignments ACTIVE/QUEUED", activeOrQueuedCount: activeOrQueued.length },
          { status: 409 }
        );
      }

      const updated = await tx.monitorRun.update({
        where: { id: runId },
        data: {
          status: MonitorRunStatus.CLOSED,
          closedAt: endedAt,
          endedAt,
        },
        select: { id: true, status: true, closedAt: true, endedAt: true, note: true },
      });

      return { ok: true, run: updated };
    });

    if (out instanceof NextResponse) return out;

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
