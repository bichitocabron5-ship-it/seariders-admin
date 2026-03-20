// src/app/api/hr/employees/[id]/detail/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      fullName: true,
      phone: true,
      email: true,
      kind: true,
      jobTitle: true,
      isActive: true,
      note: true,

      hireDate: true,
      terminationDate: true,

      internshipHoursTotal: true,
      internshipHoursUsed: true,
      internshipStartDate: true,
      internshipEndDate: true,

      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          isActive: true,
        },
      },

      workLogs: {
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        take: 50,
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
          approvedByUserId: true,
          approvedByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      },

      rates: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          rateType: true,
          amountCents: true,
          effectiveFrom: true,
          effectiveTo: true,
          note: true,
          createdAt: true,
          createdByUserId: true,
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      },

      payrollEntries: {
        orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          amountCents: true,
          concept: true,
          note: true,
          paidAt: true,
          createdAt: true,
          createdByUserId: true,
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });

  if (!employee) {
    return new NextResponse("Trabajador no existe", { status: 404 });
  }

  const workedMinutesTotal = employee.workLogs.reduce(
    (acc, l) => acc + Number(l.workedMinutes ?? 0),
    0
  );

  const payrollTotalCents = employee.payrollEntries.reduce(
    (acc, p) => acc + Number(p.amountCents ?? 0),
    0
  );

  const internshipRemaining =
    employee.internshipHoursTotal != null
      ? Math.max(0, employee.internshipHoursTotal - Number(employee.internshipHoursUsed ?? 0))
      : null;

  return NextResponse.json({
    ok: true,
    row: employee,
    summary: {
      workedMinutesTotal,
      payrollTotalCents,
      internshipRemaining,
    },
  });
}