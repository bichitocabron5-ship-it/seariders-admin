// src/app/api/hr/payroll/calculate/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { EmployeeRateType, WorkLogStatus } from "@prisma/client";

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
  employeeId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

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

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    employeeId: url.searchParams.get("employeeId") ?? "",
    periodStart: url.searchParams.get("periodStart") ?? "",
    periodEnd: url.searchParams.get("periodEnd") ?? "",
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { employeeId, periodStart, periodEnd } = parsed.data;
  const from = startOfDay(new Date(periodStart));
  const to = endOfDay(new Date(periodEnd));

  if (from > to) {
    return new NextResponse("Periodo inválido", { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      code: true,
      fullName: true,
      kind: true,
      jobTitle: true,
      isActive: true,
      internshipHoursTotal: true,
      internshipHoursUsed: true,
      internshipStartDate: true,
      internshipEndDate: true,
    },
  });

  if (!employee) {
    return new NextResponse("Trabajador no existe", { status: 404 });
  }

  const logs = await prisma.workLog.findMany({
    where: {
      employeeId,
      workDate: {
        gte: from,
        lte: to,
      },
      status: WorkLogStatus.APPROVED,
    },
    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
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

  const workedMinutes = logs.reduce((acc, l) => acc + Number(l.workedMinutes ?? 0), 0);
  const workedHours = workedMinutes / 60;
  const aprovedLogsCount = logs.length;

  const uniqueDays = new Set(
    logs.map((l) => {
      const d = new Date(l.workDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  const workedDays = uniqueDays.size;
  const workedShifts = logs.filter(
    (l) => l.status === WorkLogStatus.CLOSED || l.status === WorkLogStatus.APPROVED
  ).length;

  const rate = await prisma.employeeRate.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: to },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: from } },
      ],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      rateType: true,
      amountCents: true,
      effectiveFrom: true,
      effectiveTo: true,
      note: true,
    },
  });

  const isIntern = employee.kind === "INTERN";

  if (isIntern) {
    const internshipHoursTotal = employee.internshipHoursTotal ?? null;
    const internshipHoursUsed = employee.internshipHoursUsed ?? 0;
    const internshipHoursWorkedThisPeriod = workedMinutes / 60;
    const internshipHoursRemaining =
      internshipHoursTotal !== null
        ? Math.max(0, internshipHoursTotal - internshipHoursUsed)
        : null;

    return NextResponse.json({
      ok: true,
      employee,
      period: {
        periodStart: from.toISOString(),
        periodEnd: to.toISOString(),
      },
      summary: {
        workedMinutes,
        workedHours,
        workedDays,
        workedShifts,
        approvedLogsCount: aprovedLogsCount,
      },
      internship: {
        isIntern: true,
        internshipHoursTotal,
        internshipHoursUsed,
        internshipHoursWorkedThisPeriod,
        internshipHoursRemaining,
      },
      rate: null,
      calculation: {
        supported: false,
        suggestedAmountCents: 0,
        suggestedAmountEur: "0.00",
        message: "Trabajador en prácticas: no remunerado, controlar por bolsa de horas.",
      },
      logs,
    });
  }

  if (!rate) {
    return NextResponse.json({
      ok: true,
      employee,
      period: {
        periodStart: from.toISOString(),
        periodEnd: to.toISOString(),
      },
      summary: {
        workedMinutes,
        workedHours,
        workedDays,
        workedShifts,
        approvedLogsCount: aprovedLogsCount,
      },
      rate: null,
      calculation: {
        supported: false,
        suggestedAmountCents: 0,
        suggestedAmountEur: "0.00",
        message: "No hay tarifa vigente para este periodo.",
      },
      logs,
    });
  }

  let suggestedAmountCents = 0;
  let calculationBase = "";

  if (rate.rateType === EmployeeRateType.HOURLY) {
    suggestedAmountCents = Math.round((workedMinutes / 60) * rate.amountCents);
    calculationBase = `${workedHours.toFixed(2)} h aprobadas × ${(rate.amountCents / 100).toFixed(2)} €/h`;
  } else if (rate.rateType === EmployeeRateType.DAILY) {
    suggestedAmountCents = workedDays * rate.amountCents;
    calculationBase = `${workedDays} días aprobados × ${(rate.amountCents / 100).toFixed(2)} €/día`;
  } else if (rate.rateType === EmployeeRateType.PER_SHIFT) {
    suggestedAmountCents = workedShifts * rate.amountCents;
    calculationBase = `${workedShifts} turnos aprobados × ${(rate.amountCents / 100).toFixed(2)} €/turno`;
  } else if (rate.rateType === EmployeeRateType.MONTHLY) {
    suggestedAmountCents = rate.amountCents;
    calculationBase = `Tarifa mensual fija: ${(rate.amountCents / 100).toFixed(2)} €`;
  }

  return NextResponse.json({
    ok: true,
    employee,
    period: {
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
    },
    summary: {
      workedMinutes,
      workedHours,
      workedDays,
      workedShifts,
      approvedLogsCount: aprovedLogsCount,
    },
    rate,
    calculation: {
      supported: true,
      suggestedAmountCents,
      suggestedAmountEur: (suggestedAmountCents / 100).toFixed(2),
      calculationBase,
      message: null,
    },
    logs,
  });
}