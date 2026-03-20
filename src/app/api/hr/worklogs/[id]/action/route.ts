// src/app/api/hr/worklogs/[id]/action/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkLogStatus } from "@prisma/client";
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
  action: z.enum(["check_in_now", "check_out_now", "approve", "cancel", "reopen"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { action } = parsed.data;

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
          workedMinutes: true,
          status: true,
        },
      });

      if (!existing) throw new Error("WorkLog no existe");

      const now = new Date();

      let nextCheckInAt = existing.checkInAt;
      let nextCheckOutAt = existing.checkOutAt;
      let nextStatus = existing.status;
      const nextBreakMinutes = existing.breakMinutes ?? 0;

      if (action === "check_in_now") {
        nextCheckInAt = now;
        nextStatus = WorkLogStatus.OPEN;
      }

      if (action === "check_out_now") {
        if (!nextCheckInAt) throw new Error("No se puede fichar salida sin entrada.");
        nextCheckOutAt = now;
        nextStatus = WorkLogStatus.CLOSED;
      }

      if (action === "approve") {
        nextStatus = WorkLogStatus.APPROVED;
      }

      if (action === "cancel") {
        nextStatus = WorkLogStatus.CANCELED;
      }

      if (action === "reopen") {
        nextStatus = WorkLogStatus.OPEN;
        if (!nextCheckInAt) nextCheckInAt = now;
      }

      const autoWorkedMinutes =
        nextStatus === WorkLogStatus.CANCELED
          ? existing.workedMinutes
          : computeWorkedMinutes({
              checkInAt: nextCheckInAt,
              checkOutAt: nextCheckOutAt,
              breakMinutes: nextBreakMinutes,
            });

      const row = await tx.workLog.update({
        where: { id },
        data: {
          checkInAt: nextCheckInAt,
          checkOutAt: nextCheckOutAt,
          status: nextStatus,
          workedMinutes: autoWorkedMinutes,
          ...(action === "approve" ? { approvedByUserId: session.userId } : {}),
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
