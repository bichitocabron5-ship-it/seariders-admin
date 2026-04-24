import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Jetskis",
  description: "Control de flota de jetskis, matriculas, horas y service dentro de SeaRiders.",
});

export default function AdminJetskisLayout({ children }: { children: ReactNode }) {
  return children;
}
