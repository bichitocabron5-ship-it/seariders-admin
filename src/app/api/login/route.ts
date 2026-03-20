// src/app/api/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { redirectPathFromRole } from "@/lib/auth-redirect";

export const runtime = "nodejs";

const BodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  shift: z.enum(["MORNING", "AFTERNOON"]),
});

export async function POST(req: Request) {
  const toLoginWithError = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, req.url), 303);

  const formData = await req.formData();
  const parsed = BodySchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    shift: formData.get("shift"),
  });

  if (!parsed.success) {
    return toLoginWithError("invalid_form");
  }

  const { username, password, shift } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return toLoginWithError("bad_credentials");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return toLoginWithError("bad_credentials");
  }

  const userRole = await prisma.userRole.findFirst({
    where: { userId: user.id },
    include: { role: true },
  });

  if (!userRole) {
    return toLoginWithError("no_role");
  }

  const businessDate = new Date();
  businessDate.setHours(0, 0, 0, 0);

  const existing = await prisma.shiftSession.findFirst({
    where: {
      userId: user.id,
      shift,
      businessDate,
      endedAt: null,
    },
    select: { id: true },
  });

  const shiftSession =
    existing ??
    (await prisma.shiftSession.create({
      data: {
        userId: user.id,
        roleId: userRole.roleId,
        shift,
        businessDate,
      },
      select: { id: true },
    }));

  const role = userRole.role.name;
  const redirectPath = redirectPathFromRole(role);

  // âœ… sesiÃ³n en App Router: cookies()
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  session.userId = user.id;
  session.username = username;
  session.role = role;
  session.shift = shift;
  session.shiftSessionId = shiftSession.id;
  session.isLoggedIn = true;

  await session.save();

  return NextResponse.redirect(new URL(redirectPath, req.url), 303);
}
