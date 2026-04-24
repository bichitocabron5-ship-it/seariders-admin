import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Cierres de caja",
  description: "Control, revision y trazabilidad de cierres de caja de SeaRiders.",
});

export default function AdminCashClosuresLayout({ children }: { children: ReactNode }) {
  return children;
}
