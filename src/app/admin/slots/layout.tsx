import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAdminMetadata } from "@/lib/admin-metadata";

export const metadata: Metadata = buildAdminMetadata({
  title: "Slots",
  description: "Disponibilidad, capacidad y reglas de reserva para los slots de SeaRiders.",
});

export default function AdminSlotsLayout({ children }: { children: ReactNode }) {
  return children;
}
