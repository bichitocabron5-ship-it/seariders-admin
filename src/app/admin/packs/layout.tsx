import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Packs",
  description: "Configuracion y gestion administrativa de packs comerciales en SeaRiders.",
});

export default function AdminPacksLayout({ children }: { children: ReactNode }) {
  return children;
}
