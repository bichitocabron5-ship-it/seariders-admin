// src/app/api/hr/worklogs/bulk-action/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkArea, WorkLogStatus } from "@prisma/client";
import { recalculateInternshipHoursUsed } from "@/lib/hr";
import { addDays, endOfDay, formatDateOnly, mondayOfWeek, parseDateOnly, startOfDay } from "@/lib/date-only";

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
  action: z.enum(["approve_day_closed", "approve_week_closed"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().optional().nullable(),
  area: z.nativeEnum(WorkArea).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { action, date, employeeId, area } = parsed.data;

  try {
    const baseDate = date ? parseDateOnly(date) : new Date();

    const rangeStart =
      action === "approve_week_closed"
        ? mondayOfWeek(baseDate)
        : startOfDay(baseDate);

    const rangeEnd =
      action === "approve_week_closed"
        ? endOfDay(addDays(mondayOfWeek(baseDate), 6))
        : endOfDay(baseDate);

    const out = await prisma.$transaction(async (tx) => {
      const rows = await tx.workLog.findMany({
        where: {
          workDate: {
            gte: rangeStart,
            lte: rangeEnd,
          },
          status: WorkLogStatus.CLOSED,
          ...(employeeId ? { employeeId } : {}),
          ...(area ? { area } : {}),
        },
        select: {
          id: true,
          employeeId: true,
        },
      });

      if (rows.length === 0) {
        return {
          updatedCount: 0,
          employeeIds: [] as string[],
        };
      }

      const ids = rows.map((r) => r.id);
      const employeeIds = [...new Set(rows.map((r) => r.employeeId))];

      await tx.workLog.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          status: WorkLogStatus.APPROVED,
          approvedByUserId: session.userId,
        },
      });

      for (const empId of employeeIds) {
        await recalculateInternshipHoursUsed(tx, empId);
      }

      return {
        updatedCount: ids.length,
        employeeIds,
      };
    });

    return NextResponse.json({
      ok: true,
      action,
      range: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      },
      updatedCount: out.updatedCount,
      appliedDate: formatDateOnly(baseDate),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
