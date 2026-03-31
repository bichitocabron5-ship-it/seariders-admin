// src/app/api/login/select-role/route.ts
import { RoleName } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { finalizeLoginSession } from "@/lib/login-session";
import { type AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

const BodySchema = z.object({
  role: z.nativeEnum(RoleName),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session.pendingLogin) {
    return NextResponse.redirect(new URL("/login?error=session_expired", req.url), 303);
  }

  const formData = await req.formData();
  const parsed = BodySchema.safeParse({
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login/select-role?error=invalid_role", req.url), 303);
  }

  const { role } = parsed.data;

  if (!session.pendingLogin.roles.includes(role)) {
    return NextResponse.redirect(new URL("/login/select-role?error=invalid_role", req.url), 303);
  }

  const result = await finalizeLoginSession({
    userId: session.pendingLogin.userId,
    username: session.pendingLogin.username,
    role,
    shift: session.pendingLogin.shift,
  });

  return NextResponse.redirect(new URL(result.redirectPath, req.url), 303);
}
