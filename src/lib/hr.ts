// src/lib/hr.ts
import { PrismaClient, WorkLogStatus } from "@prisma/client";

export function computeWorkedMinutes(params: {
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  breakMinutes?: number | null;
}) {
  const { checkInAt, checkOutAt } = params;
  const breakMinutes = Math.max(0, Number(params.breakMinutes ?? 0));

  if (!checkInAt || !checkOutAt) return null;

  const diffMs = checkOutAt.getTime() - checkInAt.getTime();
  if (diffMs <= 0) return 0;

  const grossMinutes = Math.floor(diffMs / 60000);
  return Math.max(0, grossMinutes - breakMinutes);
}

export async function recalculateInternshipHoursUsed(
  prisma:
    | PrismaClient
    | Omit<
        PrismaClient,
        "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
      >,
  employeeId: string
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      kind: true,
      internshipHoursTotal: true,
    },
  });

  if (!employee) return null;
  if (employee.kind !== "INTERN") return null;

  const logs = await prisma.workLog.findMany({
    where: {
      employeeId,
      status: {
        not: WorkLogStatus.CANCELED,
      },
    },
    select: {
      workedMinutes: true,
    },
  });

  const totalMinutes = logs.reduce((acc, l) => acc + Number(l.workedMinutes ?? 0), 0);

  const usedHours = Math.round(totalMinutes / 60);

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      internshipHoursUsed: usedHours,
    },
    select: {
      id: true,
      internshipHoursTotal: true,
      internshipHoursUsed: true,
    },
  });

  return {
    employeeId: updated.id,
    internshipHoursTotal: updated.internshipHoursTotal,
    internshipHoursUsed: updated.internshipHoursUsed,
    internshipHoursRemaining:
      updated.internshipHoursTotal != null
        ? Math.max(0, updated.internshipHoursTotal - updated.internshipHoursUsed)
        : null,
  };
}