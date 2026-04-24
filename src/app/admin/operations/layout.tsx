import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Salidas internas",
  description: "Control operativo de salidas internas y trazabilidad de uso de recursos en SeaRiders.",
});

export default function AdminOperationsLayout({ children }: { children: ReactNode }) {
  return children;
}
