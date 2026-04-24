import type { ReactNode } from "react";

import { requirePageRole } from "@/lib/auth";

export default async function ExecutiveLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["ADMIN"]);
  return <>{children}</>;
}
