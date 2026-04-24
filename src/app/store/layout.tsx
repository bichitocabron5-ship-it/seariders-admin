import type { ReactNode } from "react";

import { requirePageRole } from "@/lib/auth";

export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole(["STORE", "ADMIN"]);
  return <>{children}</>;
}
