import type { ReactNode } from "react";

import { requirePageRole } from "@/lib/auth";

export default async function BoothLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["BOOTH", "ADMIN"]);
  return <>{children}</>;
}
