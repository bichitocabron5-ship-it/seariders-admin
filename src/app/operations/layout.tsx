import type { ReactNode } from "react";

import { requirePageRole } from "@/lib/auth";

export default async function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["ADMIN", "STORE", "BOOTH", "PLATFORM"]);
  return <>{children}</>;
}
