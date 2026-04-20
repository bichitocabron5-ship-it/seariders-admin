import { RoleName, ShiftName } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";

type FindShiftSessionArgs = {
  userId: string;
  role: RoleName;
  shift?: ShiftName;
  shiftSessionId?: string | null;
};

export async function findCurrentShiftSession(args: FindShiftSessionArgs) {
  const businessDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ));

  if (args.shiftSessionId) {
    const currentFromSession = await prisma.shiftSession.findFirst({
      where: {
        id: args.shiftSessionId,
        userId: args.userId,
        businessDate,
        role: { name: args.role },
        ...(args.shift ? { shift: args.shift } : {}),
      },
      select: { id: true, shift: true, businessDate: true },
    });

    if (currentFromSession) return currentFromSession;
  }

  const currentByDay = await prisma.shiftSession.findFirst({
    where: {
      userId: args.userId,
      businessDate,
      role: { name: args.role },
      ...(args.shift ? { shift: args.shift } : {}),
    },
    select: { id: true, shift: true, businessDate: true },
    orderBy: { startedAt: "desc" },
  });

  if (currentByDay) return currentByDay;

  return prisma.shiftSession.findFirst({
    where: {
      userId: args.userId,
      businessDate,
      endedAt: null,
      role: { name: args.role },
      ...(args.shift ? { shift: args.shift } : {}),
    },
    select: { id: true, shift: true, businessDate: true },
    orderBy: { startedAt: "desc" },
  });
}
