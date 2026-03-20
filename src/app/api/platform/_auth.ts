// src/app/api/platform/_auth.ts
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

type RequirePlatformOrAdminOptions = {
  allowStore?: boolean;
  allowMechanic?: boolean;
};

export async function requirePlatformOrAdmin(
  options?: RequirePlatformOrAdminOptions
) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;

  const allowedRoles = new Set(["ADMIN", "PLATFORM"]);

  if (options?.allowStore) {
    allowedRoles.add("STORE");
  }

  if (options?.allowMechanic) {
    allowedRoles.add("MECHANIC");
  }

  if (allowedRoles.has(session.role as string)) return session;

  return null;
}
