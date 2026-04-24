import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Catalogo",
  description: "Configuracion del catalogo de servicios, opciones y estructura comercial de SeaRiders.",
});

export default function AdminCatalogLayout({ children }: { children: ReactNode }) {
  return children;
}
