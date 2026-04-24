import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";

import { redirectPathFromRole } from "@/lib/auth-redirect";
import { type AppSession, sessionOptions } from "@/lib/session";

export async function getAppSession() {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
}

export async function requireSession() {
  const session = await getAppSession();
  if (!session?.userId || !session.role) {
    redirect("/login");
  }
  return session;
}

export async function requirePageRole(allowedRoles: string[]) {
  const session = await requireSession();
  const role = String(session.role);

  if (!allowedRoles.includes(role)) {
    redirect(redirectPathFromRole(role));
  }

  return session;
}

export async function requireApiRole(allowedRoles: string[]) {
  const session = await getAppSession();
  if (!session?.userId || !session.role) return null;
  return allowedRoles.includes(String(session.role)) ? session : null;
}
