import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Bonos",
  description: "Gestion administrativa de bonos, productos y consumos de SeaRiders.",
});

export default function AdminPassesLayout({ children }: { children: ReactNode }) {
  return children;
}
