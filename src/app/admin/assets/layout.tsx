import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Nautica",
  description: "Gestion administrativa de recursos nauticos, boats, towboat y activos especiales de SeaRiders.",
});

export default function AdminAssetsLayout({ children }: { children: ReactNode }) {
  return children;
}
