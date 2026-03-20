// src/lib/require-admin.ts
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}