import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Bar",
  description: "Configuracion administrativa del punto BAR: catalogo, inventario y promociones.",
});

export default function AdminBarLayout({ children }: { children: ReactNode }) {
  return children;
}
