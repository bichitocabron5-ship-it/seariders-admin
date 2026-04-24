import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Descuentos",
  description: "Gestion de descuentos, campañas y reglas promocionales de SeaRiders.",
});

export default function AdminDiscountsLayout({ children }: { children: ReactNode }) {
  return children;
}
