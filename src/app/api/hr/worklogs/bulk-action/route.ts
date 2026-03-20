// src/app/api/hr/worklogs/bulk-action/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkArea, WorkLogStatus } from "@prisma/client";
import { recalculateInternshipHoursUsed } from "@/lib/hr";

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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function mondayOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const Body = z.object({
  action: z.enum(["approve_day_closed", "approve_week_closed"]),
  date: z.string().optional(), // YYYY-MM-DD
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
    const baseDate = date ? new Date(`${date}T00:00:00`) : new Date();

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
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
