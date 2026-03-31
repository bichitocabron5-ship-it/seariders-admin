import { RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { redirectPathFromRole } from "@/lib/auth-redirect";
import { type AppSession, sessionOptions } from "@/lib/session";

export async function finalizeLoginSession(args: {
  userId: string;
  username: string;
  role: RoleName;
  shift: "MORNING" | "AFTERNOON";
}) {
  const businessDate = new Date();
  businessDate.setHours(0, 0, 0, 0);

  const roleRow = await prisma.role.findUnique({
    where: { name: args.role },
    select: { id: true },
  });

  if (!roleRow) {
    throw new Error(`Rol no encontrado: ${args.role}`);
  }

  const existing = await prisma.shiftSession.findFirst({
    where: {
      userId: args.userId,
      shift: args.shift,
      businessDate,
      roleId: roleRow.id,
      endedAt: null,
    },
    select: { id: true },
  });

  const shiftSession =
    existing ??
    (await prisma.shiftSession.create({
      data: {
        userId: args.userId,
        roleId: roleRow.id,
        shift: args.shift,
        businessDate,
      },
      select: { id: true },
    }));

  const userRoles = await prisma.userRole.findMany({
    where: { userId: args.userId },
    include: { role: true },
  });

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  session.userId = args.userId;
  session.username = args.username;
  session.role = args.role;
  session.availableRoles = userRoles.map((userRole) => userRole.role.name);
  session.shift = args.shift;
  session.shiftSessionId = shiftSession.id;
  session.pendingLogin = undefined;
  session.isLoggedIn = true;

  await session.save();

  return {
    redirectPath: redirectPathFromRole(args.role),
    shiftSessionId: shiftSession.id,
  };
}
