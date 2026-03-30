"use client";

import type React from "react";

import { Card, Stat, styles } from "@/components/ui";

type Method = "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";

type Summary = {
  ok: boolean;
  error?: string;
  computed?: {
    service?: { NET?: { byMethod?: Partial<Record<Method, number>> } };
    all?: { NET?: number };
    meta?: { windowFrom?: string | null; windowTo?: string | null };
  };
  isClosed?: boolean;
  closure?: { id: string; closedAt: string } | null;
};

type BarOverviewSectionProps = {
  today: string;
  summary: Summary | null;
  systemNet: string;
  pendingTasksCount: number;
  cateringCount: number;
  extrasCount: number;
  returnTasksCount: number;
  hhmm: (value?: string | Date | null) => string;
};

export function BarOverviewSection({
  today,
  summary,
  systemNet,
  pendingTasksCount,
  cateringCount,
  extrasCount,
  returnTasksCount,
  hhmm,
}: BarOverviewSectionProps) {
  return (
    <>
      <Card>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div
            style={{
              borderRadius: 24,
              padding: 22,
              color: "#e2e8f0",
              background:
                "radial-gradient(circle at top left, rgba(134, 239, 172, 0.18), transparent 34%), linear-gradient(135deg, #052e2b 0%, #0f766e 50%, #082f49 100%)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#a7f3d0" }}>
                Operativa de punto
              </span>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#fff", lineHeight: 1.05 }}>Bar</div>
              <div style={{ fontSize: 14, color: "#d1fae5", maxWidth: 620 }}>
                Ventas rápidas y seguimiento de entregas del punto BAR durante el turno.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Origen: BAR
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Fecha: {today}
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Ventana: {summary?.ok ? `${hhmm(summary.computed?.meta?.windowFrom)} - ${hhmm(summary.computed?.meta?.windowTo)}` : "--"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <Stat label="Sistema neto" value={systemNet} />
            <Stat label="Pendientes de entrega" value={pendingTasksCount} />
            <Stat label="Cierre" value={summary?.isClosed ? "Cerrado" : "Abierto"} />
          </div>
        </div>
      </Card>

      <div style={styles.grid3}>
        <Stat label="Catering pendiente" value={cateringCount} />
        <Stat label="Extras pendientes" value={extrasCount} />
        <Stat label="Extras pendientes de devolución" value={returnTasksCount} />
        <Stat label="Ventas del turno" value={systemNet} />
      </div>
    </>
  );
}
