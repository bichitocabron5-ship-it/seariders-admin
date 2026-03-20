// src/app/api/platform/assignments/[assignmentId]/extend/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ExtraTimeStatus, MonitorRunStatus, RunAssignmentStatus } from "@prisma/client";
import { requirePlatformOrAdmin } from "@/app/api/platform/_auth";

export const runtime = "nodejs";

const ServiceCode = z.enum(["JETSKI_EXTRA_20", "JETSKI_EXTRA_40", "BOAT_EXTRA_60", "BOAT_EXTRA_120"]);

const Body = z.object({
  serviceCode: ServiceCode,
  // opcional si prefieres, pero yo lo derivaría de serviceCode:
  extraMinutes: z.number().int().min(5).max(240).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ assignmentId: string }> }) {
  const session = await requirePlatformOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { assignmentId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "MonitorRunAssignment" WHERE "id" = ${assignmentId} FOR UPDATE`;

      const a = await tx.monitorRunAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,

          reservationId: true, // ✅
          runId: true,         // ✅
          jetskiId: true,      // ✅
          reservationUnitId: true,

          run: { select: { id: true, status: true } },
        },
      });

      if (!a) throw new Error("Assignment no existe");
      if (a.status !== RunAssignmentStatus.ACTIVE) throw new Error(`Solo se puede extender si está ACTIVE (ahora: ${a.status})`);
      if (a.run.status !== MonitorRunStatus.READY &&
          a.run.status !== MonitorRunStatus.IN_SEA) {
      throw new Error(`La salida no está abierta (${a.run.status})`);
      }

      const minutesByCode: Record<string, number> = {
        JETSKI_EXTRA_20: 20,
        JETSKI_EXTRA_40: 40,
        BOAT_EXTRA_60: 60,
        BOAT_EXTRA_120: 120,
      };

      const extraMinutes = b.extraMinutes ?? minutesByCode[b.serviceCode];
      if (!extraMinutes) throw new Error("serviceCode inválido");
      const serviceCode = b.serviceCode; // ✅ ahora sí existe
      
      // base para extender: si expectedEndAt existe, desde ahí; si no, calcula desde startedAt
      if (!a.expectedEndAt && !a.startedAt) throw new Error("Assignment sin startedAt");
      const baseExpected =
        a.expectedEndAt ?? new Date(a.startedAt!.getTime() + Number(a.durationMinutesSnapshot ?? 0) * 60000);
      const newExpected = new Date(baseExpected.getTime() + extraMinutes * 60000);

      const updated = await tx.monitorRunAssignment.update({
        where: { id: a.id },
        data: {
          expectedEndAt: newExpected,
          durationMinutesSnapshot: Number(a.durationMinutesSnapshot ?? 0) + extraMinutes,
        },
        select: {
          id: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,
        },
      });

      await tx.extraTimeEvent.create({
        data: {
          reservationId: a.reservationId,
          assignmentId: a.id,
          runId: a.runId,
          jetskiId: a.jetskiId!,
          reservationUnitId: a.reservationUnitId ?? null,

          serviceCode,
          extraMinutes,

          status: ExtraTimeStatus.PENDING,
          createdByUserId: session.userId!,
        },
      });
      
      return { ok: true, assignmentId: updated.id, expectedEndAt: updated.expectedEndAt, durationMinutesSnapshot: updated.durationMinutesSnapshot };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
