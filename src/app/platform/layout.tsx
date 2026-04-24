import type { ReactNode } from "react";

import { requirePageRole } from "@/lib/auth";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["PLATFORM", "ADMIN"]);
  return <>{children}</>;
}
