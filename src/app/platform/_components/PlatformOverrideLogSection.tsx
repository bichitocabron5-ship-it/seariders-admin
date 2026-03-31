"use client";

import type { CSSProperties } from "react";
import type { PlatformOverrideLogRow } from "../types/types";

function fmtDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function actionLabel(action: PlatformOverrideLogRow["action"]) {
  switch (action) {
    case "FORCE_READY":
      return "Forzar READY";
    case "FORCE_DEPART":
      return "Forzar salida";
    case "FORCE_CLOSE_RUN":
      return "Cerrar run manual";
    default:
      return action;
  }
}

function toneForAction(action: PlatformOverrideLogRow["action"]) {
  switch (action) {
    case "FORCE_READY":
      return { bg: "#eff6ff", bd: "#bfdbfe", fg: "#1d4ed8" };
    case "FORCE_DEPART":
      return { bg: "#fff7ed", bd: "#fed7aa", fg: "#b45309" };
    case "FORCE_CLOSE_RUN":
      return { bg: "#fff1f2", bd: "#fecaca", fg: "#be123c" };
    default:
      return { bg: "#f8fafc", bd: "#dbe4ea", fg: "#334155" };
  }
}

export default function PlatformOverrideLogSection({
  rows,
  loading,
  error,
  onRefresh,
}: {
  rows: PlatformOverrideLogRow[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
}) {
  return (
    <section style={sectionCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={eyebrow}>Auditoría</div>
          <div style={title}>Overrides operativos</div>
          <div style={subtitle}>Quién forzó qué, cuándo y por qué, sin salir de Platform.</div>
        </div>

        <button type="button" onClick={() => void onRefresh()} style={refreshBtn}>
          Refrescar log
        </button>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}
      {loading ? <div style={infoBox}>Cargando overrides...</div> : null}

      {!loading && rows.length === 0 ? (
        <div style={emptyBox}>Todavía no hay overrides operativos registrados.</div>
      ) : null}

      {rows.length > 0 ? (
        <div style={grid}>
          {rows.map((row) => {
            const tone = toneForAction(row.action);
            const actor =
              row.createdBy?.fullName ||
              row.createdBy?.username ||
              "Usuario no disponible";

            return (
              <div key={row.id} style={{ ...itemCard, borderColor: tone.bd }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>
                      {actionLabel(row.action)}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 800 }}>
                      {row.targetType === "RESERVATION"
                        ? `${row.reservation?.customerName || "Reserva"} · ${row.reservation?.status || row.targetId}`
                        : `${row.run?.monitorName || "Run"} · ${row.run?.kind || row.targetId} · ${row.run?.status || "-"}`}
                    </div>
                  </div>

                  <div style={{ ...pill, background: tone.bg, borderColor: tone.bd, color: tone.fg }}>
                    {row.targetType === "RESERVATION" ? "Reserva" : "Run"}
                  </div>
                </div>

                <div style={reasonBox}>{row.reason}</div>

                <div style={metaRow}>
                  <span>{actor}</span>
                  <span>{fmtDateTime(row.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

const sectionCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  padding: "clamp(18px, 3vw, 24px)",
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 14,
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#0369a1",
};

const title: CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const refreshBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const infoBox: CSSProperties = {
  color: "#475569",
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};

const emptyBox: CSSProperties = {
  border: "1px dashed #d7deea",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  color: "#6c819d",
  background: "rgba(255,255,255,0.45)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const itemCard: CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
  background: "#fff",
};

const pill: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 11,
  fontWeight: 900,
};

const reasonBox: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
};

const metaRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
};
