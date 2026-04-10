// src/app/api/hr/worklogs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { WorkArea, WorkLogStatus } from "@prisma/client";
import { computeWorkedMinutes, recalculateInternshipHoursUsed } from "@/lib/hr";
import { endOfDay, parseDateOnly, startOfDay } from "@/lib/date-only";

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

const Query = z.object({
  employeeId: z.string().optional(),
  area: z.nativeEnum(WorkArea).optional(),
  status: z.nativeEnum(WorkLogStatus).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  take: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    area: (url.searchParams.get("area") ?? undefined) as WorkArea | undefined,
    status: (url.searchParams.get("status") ?? undefined) as WorkLogStatus | undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    fromDate: url.searchParams.get("fromDate") ?? undefined,
    toDate: url.searchParams.get("toDate") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { employeeId, area, status, from, to, fromDate, toDate, take } = parsed.data;

  const rangeFrom = fromDate ? startOfDay(parseDateOnly(fromDate)) : from ? new Date(from) : undefined;
  const rangeTo = toDate ? endOfDay(parseDateOnly(toDate)) : to ? new Date(to) : undefined;

  const rows = await prisma.workLog.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(area ? { area } : {}),
      ...(status ? { status } : {}),
      ...(rangeFrom || rangeTo
        ? {
            workDate: {
              ...(rangeFrom ? { gte: rangeFrom } : {}),
              ...(rangeTo ? { lte: rangeTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take,
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
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          code: true,
          fullName: true,
          kind: true,
          jobTitle: true,
          isActive: true,
        },
      },
      approvedByUserId: true,
      approvedByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

const Body = z.object({
  employeeId: z.string().min(1),
  workDate: z.string().datetime(),
  checkInAt: z.string().datetime().optional().nullable(),
  checkOutAt: z.string().datetime().optional().nullable(),
  breakMinutes: z.coerce.number().int().min(0).optional().default(0),
  workedMinutes: z.coerce.number().int().min(0).optional().nullable(),
  area: z.nativeEnum(WorkArea).optional().default(WorkArea.OTHER),
  status: z.nativeEnum(WorkLogStatus).optional().default(WorkLogStatus.OPEN),
  note: z.string().trim().max(1000).optional().nullable(),
  approvedByUserId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: b.employeeId },
        select: { id: true, isActive: true, kind: true },
      });
      if (!employee) throw new Error("Trabajador no existe");

      const checkInAt = b.checkInAt ? new Date(b.checkInAt) : null;
      const checkOutAt = b.checkOutAt ? new Date(b.checkOutAt) : null;
      const breakMinutes = b.breakMinutes ?? 0;

      const autoWorkedMinutes =
        b.workedMinutes ?? computeWorkedMinutes({ checkInAt, checkOutAt, breakMinutes });

      let autoStatus = b.status;
      if (!b.status) {
        autoStatus = checkOutAt ? "CLOSED" : "OPEN";
      }

      const row = await tx.workLog.create({
        data: {
          employeeId: b.employeeId,
          workDate: new Date(b.workDate),
          checkInAt,
          checkOutAt,
          breakMinutes,
          workedMinutes: autoWorkedMinutes,
          area: b.area,
          status: autoStatus,
          note: b.note?.trim() || null,
          approvedByUserId: b.approvedByUserId || null,
          createdByUserId: session.userId,
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
        },
      });

      const internship = await recalculateInternshipHoursUsed(tx, b.employeeId);

      return { row, internship };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
