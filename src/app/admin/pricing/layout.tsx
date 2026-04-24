import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Precios",
  description: "Gestion de tarifas, configuracion comercial e historico de precios de SeaRiders.",
});

export default function AdminPricingLayout({ children }: { children: ReactNode }) {
  return children;
}
