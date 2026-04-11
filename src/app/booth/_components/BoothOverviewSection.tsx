"use client";

import type React from "react";

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
  ghostBtn,
  darkBtn,
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
  ghostBtn: React.CSSProperties;
  darkBtn: React.CSSProperties;
  onReload: () => void;
}) {
  const shiftLabel = cashClosureSummary?.computed?.meta?.shift === "AFTERNOON" ? "Tarde" : "Mañana";

  return (
    <>
      <section
        style={{
          background:
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%), radial-gradient(circle at right bottom, rgba(45, 212, 191, 0.12), transparent 28%), linear-gradient(135deg, #082f49 0%, #0f766e 55%, #052e2b 100%)",
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
              Operativa de carpa
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1, fontWeight: 950 }}>Booth</h1>
            <div style={{ fontSize: 14, color: "#ccfbf1" }}>
              Pre-reservas, cobro parcial, agrupación por taxiboat y control de caja del punto en una sola vista.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, width: "min(100%, 380px)" }}>
            <a href="/booth/cash-closures" style={{ ...ghostBtn, background: "rgba(255,255,255,0.9)" }}>
              Cierre de caja
            </a>
            <a href="/booth/history" style={{ ...ghostBtn, background: "rgba(255,255,255,0.9)" }}>
              Histórico
            </a>
            <button onClick={onReload} style={{ ...darkBtn, border: "1px solid rgba(255,255,255,0.24)", background: "#0f172a", width: "100%" }}>
              Refrescar
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPill}>Reservas hoy: {rowsCount}</span>
          <span style={heroPill}>Viajes OPEN: {openTrips}</span>
          <span style={heroPill}>Caja: {isCashClosed ? "Cerrada" : "Abierta"}</span>
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
              <div style={{ fontWeight: 900 }}>Cierre de caja (BOOTH · {shiftLabel})</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Sistema neto: <b>{euros(cashClosureSummary.computed?.all?.NET ?? 0)}</b> · Estado: {cashClosureSummary.isClosed ? "CERRADO" : "ABIERTO"}
              </div>
            </div>
            <a
              href="/booth/cash-closures"
              style={{
                ...ghostBtn,
                background: cashClosureSummary.isClosed ? "#f3f4f6" : "white",
                pointerEvents: cashClosureSummary.isClosed ? "none" : "auto",
                opacity: cashClosureSummary.isClosed ? 0.6 : 1,
              }}
            >
              {cashClosureSummary.isClosed ? "Caja cerrada" : "Cerrar caja"}
            </a>
          </div>
        </section>
      ) : null}
    </>
  );
}

const heroPill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid rgba(153, 246, 228, 0.4)",
  background: "rgba(255,255,255,0.1)",
  color: "#ecfeff",
};
