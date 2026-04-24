import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Regalos",
  description: "Gestion de gift vouchers, catalogo asociado y seguimiento de canjes en SeaRiders.",
});

export default function AdminGiftsLayout({ children }: { children: ReactNode }) {
  return children;
}
