import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { redirectPathFromRole } from "@/lib/auth-redirect";

export default async function BarLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !session.role) {
    redirect("/login");
  }

  const role = String(session.role);

  if (!["BAR", "ADMIN"].includes(role)) {
    redirect(redirectPathFromRole(session.role));
  }

  return <>{children}</>;
}
