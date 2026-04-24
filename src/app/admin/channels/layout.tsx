import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Canales y comisiones",
  description: "Gestion de canales de venta y reglas de comision dentro del ecosistema SeaRiders.",
});

export default function AdminChannelsLayout({ children }: { children: ReactNode }) {
  return children;
}
