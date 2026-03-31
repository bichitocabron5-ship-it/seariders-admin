// src/app/api/login/route.ts
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { finalizeLoginSession } from "@/lib/login-session";
import { type AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

const BodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  shift: z.enum(["MORNING", "AFTERNOON"]),
  role: z.nativeEnum(RoleName).optional(),
});

export async function POST(req: Request) {
  const toLoginWithError = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, req.url), 303);

  const formData = await req.formData();
  const parsed = BodySchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    shift: formData.get("shift"),
    role: formData.get("role") || undefined,
  });

  if (!parsed.success) {
    return toLoginWithError("invalid_form");
  }

  const { username, password, shift, role } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return toLoginWithError("bad_credentials");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return toLoginWithError("bad_credentials");
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });

  if (userRoles.length === 0) {
    return toLoginWithError("no_role");
  }

  const availableRoles = userRoles.map((userRole) => userRole.role.name);

  if (role) {
    if (!availableRoles.includes(role)) {
      return toLoginWithError("invalid_role");
    }

    const result = await finalizeLoginSession({
      userId: user.id,
      username,
      role,
      shift,
    });

    return NextResponse.redirect(new URL(result.redirectPath, req.url), 303);
  }

  if (availableRoles.length === 1) {
    const result = await finalizeLoginSession({
      userId: user.id,
      username,
      role: availableRoles[0],
      shift,
    });

    return NextResponse.redirect(new URL(result.redirectPath, req.url), 303);
  }

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  session.userId = undefined;
  session.username = undefined;
  session.role = undefined;
  session.availableRoles = undefined;
  session.shift = undefined;
  session.shiftSessionId = undefined;
  session.isLoggedIn = false;
  session.pendingLogin = {
    userId: user.id,
    username,
    shift,
    roles: availableRoles,
  };

  await session.save();

  return NextResponse.redirect(new URL("/login/select-role", req.url), 303);
}
