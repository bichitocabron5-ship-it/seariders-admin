// src/app/api/platform/runs/[runId]/close/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const Body = z.object({
  endedAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { runId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const endedAt = parsed.data.endedAt ? new Date(parsed.data.endedAt) : new Date();

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
          assignments: { select: { id: true, status: true } },
        },
      });
      if (!run) throw new Error("Run no existe");

      if (run.status === MonitorRunStatus.CLOSED) {
        return { ok: true, runId: run.id, alreadyClosed: true };
      }

      if (![MonitorRunStatus.READY, MonitorRunStatus.IN_SEA].includes(run.status)) {
        throw new Error(`No se puede cerrar en estado ${run.status}`);
      }

      const activeOrQueuedCount = (run.assignments ?? []).filter(
        (a) =>
          a.status === RunAssignmentStatus.ACTIVE ||
          a.status === RunAssignmentStatus.QUEUED
      ).length;
      if (activeOrQueuedCount > 0) {
        return NextResponse.json(
          { error: "No se puede cerrar: hay assignments ACTIVE/QUEUED", activeOrQueuedCount },
          { status: 409 }
        );
      }

      const updated = await tx.monitorRun.update({
        where: { id: runId },
        data: {
          status: MonitorRunStatus.CLOSED,
          closedAt: endedAt,     // si existe en tu schema
          endedAt: endedAt,      // si existe en tu schema
        },
        select: { id: true, status: true, closedAt: true, endedAt: true },
      });

      return { ok: true, run: updated };
    });

    // si dentro devolvimos NextResponse (409), lo pasamos tal cual
    if (out instanceof NextResponse) return out;

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
