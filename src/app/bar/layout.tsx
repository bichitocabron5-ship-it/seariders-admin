import { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth";

export default async function BarLayout({ children }: { children: ReactNode }) {
  await requirePageRole(["BAR", "ADMIN"]);
  return <>{children}</>;
}
