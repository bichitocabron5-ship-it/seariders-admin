// src/app/api/hr/worklogs/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkArea, WorkLogStatus } from "@prisma/client";
import { computeWorkedMinutes, recalculateInternshipHoursUsed } from "@/lib/hr";

export const runtime = "nodejs";

async function requireHrOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (["ADMIN", "HR"].includes(session.role as string)) return session;
  return null;
}

const Body = z.object({
  checkInAt: z.string().datetime().optional().nullable(),
  checkOutAt: z.string().datetime().optional().nullable(),
  breakMinutes: z.coerce.number().int().min(0).optional(),
  workedMinutes: z.coerce.number().int().min(0).optional().nullable(),
  area: z.nativeEnum(WorkArea).optional(),
  status: z.nativeEnum(WorkLogStatus).optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  approvedByUserId: z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const existing = await tx.workLog.findUnique({
        where: { id },
        select: {
          id: true,
          employeeId: true,
          checkInAt: true,
          checkOutAt: true,
          breakMinutes: true,
          status: true,
        },
      });
      if (!existing) throw new Error("WorkLog no existe");

      const nextCheckInAt =
        b.checkInAt !== undefined ? (b.checkInAt ? new Date(b.checkInAt) : null) : existing.checkInAt;

      const nextCheckOutAt =
        b.checkOutAt !== undefined ? (b.checkOutAt ? new Date(b.checkOutAt) : null) : existing.checkOutAt;

      const nextBreakMinutes =
        b.breakMinutes !== undefined ? b.breakMinutes : existing.breakMinutes;

      const autoWorkedMinutes =
        b.workedMinutes !== undefined
          ? b.workedMinutes
          : computeWorkedMinutes({
              checkInAt: nextCheckInAt,
              checkOutAt: nextCheckOutAt,
              breakMinutes: nextBreakMinutes,
            });

      let autoStatus = b.status ?? existing.status;
      if (b.status === undefined) {
        if (!nextCheckInAt) autoStatus = "OPEN";
        else if (nextCheckInAt && !nextCheckOutAt) autoStatus = "OPEN";
        else if (nextCheckInAt && nextCheckOutAt) autoStatus = "CLOSED";
      }

      const row = await tx.workLog.update({
        where: { id },
        data: {
          ...(b.checkInAt !== undefined ? { checkInAt: nextCheckInAt } : {}),
          ...(b.checkOutAt !== undefined ? { checkOutAt: nextCheckOutAt } : {}),
          ...(b.breakMinutes !== undefined ? { breakMinutes: nextBreakMinutes } : {}),
          workedMinutes: autoWorkedMinutes,
          ...(b.area !== undefined ? { area: b.area } : {}),
          ...(b.status !== undefined ? { status: b.status } : { status: autoStatus }),
          ...(b.note !== undefined ? { note: b.note?.trim() || null } : {}),
          ...(b.approvedByUserId !== undefined ? { approvedByUserId: b.approvedByUserId || null } : {}),
        },
        select: {
          id: true,
          employeeId: true,
          workDate: true,
          checkInAt: true,
          checkOutAt: true,
          breakMinutes: true,
          workedMinutes: true,
          area: true,
          status: true,
          note: true,
          updatedAt: true,
        },
      });

      const internship = await recalculateInternshipHoursUsed(tx, existing.employeeId);

      return { row, internship };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
