import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Gastos",
  description: "Contabilidad operativa, proveedores y seguimiento de gastos en SeaRiders.",
});

export default function AdminExpensesLayout({ children }: { children: ReactNode }) {
  return children;
}
