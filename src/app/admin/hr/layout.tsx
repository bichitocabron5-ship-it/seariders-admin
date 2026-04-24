import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Recursos humanos",
  description: "Gestion de trabajadores, estructura interna y organizacion de personal en SeaRiders.",
});

export default function AdminHrLayout({ children }: { children: ReactNode }) {
  return children;
}
