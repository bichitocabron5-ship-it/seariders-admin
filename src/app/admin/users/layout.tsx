import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Usuarios",
  description: "Gestion de accesos, roles y credenciales del panel SeaRiders.",
});

export default function AdminUsersLayout({ children }: { children: ReactNode }) {
  return children;
}
