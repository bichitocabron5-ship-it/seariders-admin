"use client";

import type React from "react";
import { ActionButton, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

type CashClosureSummary = {
  ok: boolean;
  isClosed?: boolean;
  closure?: { isVoided?: boolean | null } | null;
  computed?: { all?: { NET?: number }; meta?: { shift?: string | null } };
  error?: string;
};

export default function BoothOverviewSection({
  rowsCount,
  openTrips,
  reservationsPending,
  reservationsReceived,
  queueWaiting,
  cashClosureSummary,
  isCashClosed,
  euros,
  cardStyle,
  metricCard,
  onReload,
}: {
  rowsCount: number;
  openTrips: number;
  reservationsPending: number;
  reservationsReceived: number;
  queueWaiting: number;
  cashClosureSummary: CashClosureSummary | null;
  isCashClosed: boolean;
  euros: (cents: number) => string;
  cardStyle: React.CSSProperties;
  metricCard: React.CSSProperties;
  onReload: () => void;
}) {
  const shiftLabel = cashClosureSummary?.computed?.meta?.shift === "AFTERNOON" ? "Tarde" : "Mañana";

  return (
    <>
      <section
        style={{
          background: brand.gradients.hero,
          color: "#ecfeff",
          display: "grid",
          gap: 18,
          borderRadius: 24,
          padding: "clamp(18px, 3vw, 28px)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#99f6e4" }}>
              SeaRiders Booth
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1, fontWeight: 950 }}>Booth</h1>
            <div style={{ fontSize: 14, color: "#ccfbf1" }}>
              Pre-reservas, cobro parcial, agrupación por taxiboat y control de caja del punto en una sola vista.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, width: "min(100%, 380px)" }}>
            <ActionButton href="/booth/cash-closures" variant="secondary" style={{ background: "rgba(255,255,255,0.92)" }}>
              Cierre de caja
            </ActionButton>
            <ActionButton href="/booth/history" variant="secondary" style={{ background: "rgba(255,255,255,0.92)" }}>
              Histórico
            </ActionButton>
            <ActionButton onClick={onReload} variant="primary" style={{ width: "100%" }}>
              Refrescar
            </ActionButton>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatusBadge tone="info">Reservas hoy: {rowsCount}</StatusBadge>
          <StatusBadge tone="neutral">Viajes OPEN: {openTrips}</StatusBadge>
          <StatusBadge tone={isCashClosed ? "warning" : "success"}>
            Caja: {isCashClosed ? "Cerrada" : "Abierta"}
          </StatusBadge>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Pendientes de cobro</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{reservationsPending}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Recibidas en tienda</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{reservationsReceived}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>En cola sin viaje</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{queueWaiting}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Neto de caja</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{euros(cashClosureSummary?.computed?.all?.NET ?? 0)}</div>
        </article>
      </section>

      {cashClosureSummary?.ok ? (
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Cierre de caja (BOOTH | {shiftLabel})</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Sistema neto: <b>{euros(cashClosureSummary.computed?.all?.NET ?? 0)}</b> | Estado: {cashClosureSummary.isClosed ? "CERRADO" : "ABIERTO"}
              </div>
            </div>
            <ActionButton
              href="/booth/cash-closures"
              variant="secondary"
              style={{
                background: cashClosureSummary.isClosed ? "#f3f4f6" : "#fff",
                pointerEvents: cashClosureSummary.isClosed ? "none" : "auto",
                opacity: cashClosureSummary.isClosed ? 0.6 : 1,
              }}
            >
              {cashClosureSummary.isClosed ? "Caja cerrada" : "Cerrar caja"}
            </ActionButton>
          </div>
        </section>
      ) : null}
    </>
  );
}
