"use client";

import type React from "react";

import type { AssetRow, AssetStatus } from "../../types";

export default function AdminAssetsListSection({
  rows,
  loading,
  error,
  cardStyle,
  errorBox,
  fmtDateTime,
  onEdit,
}: {
  rows: AssetRow[];
  loading: boolean;
  error: string | null;
  cardStyle: React.CSSProperties;
  errorBox: React.CSSProperties;
  fmtDateTime: (iso: string) => string;
  onEdit: (row: AssetRow) => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 20 }}>Listado</div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{rows.length} registro(s)</div>
      </div>

      {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}
      {!loading && !error && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay recursos.</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onEdit(row)}
            style={{
              textAlign: "left",
              border: "1px solid #e5edf4",
              borderRadius: 18,
              padding: 14,
              background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>{row.name}</div>
                  <span style={statusBadge(row.status)}>{row.status}</span>
                  <span style={usageBadge(row.platformUsage)}>{usageLabel(row.platformUsage)}</span>
                </div>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  {row.type}
                  {row.code ? ` · ${row.code}` : ""}
                  {row.plate ? ` · ${row.plate}` : ""}
                  {row.chassisNumber ? ` · Bastidor ${row.chassisNumber}` : ""}
                  {row.maxPax ? ` · Pax máx. ${row.maxPax}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {row.model ? `Modelo ${row.model}` : "Modelo no informado"}
                  {row.year ? ` · Año ${row.year}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Actualizado: <b>{fmtDateTime(row.updatedAt)}</b>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

const badgeBase: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
};

function statusBadge(status: AssetStatus): React.CSSProperties {
  if (status === "OPERATIONAL") {
    return { ...badgeBase, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
  }
  if (status === "MAINTENANCE") {
    return { ...badgeBase, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
  }
  return { ...badgeBase, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" };
}

function usageBadge(usage: "CUSTOMER_ASSIGNABLE" | "RUN_BASE_ONLY" | "HIDDEN"): React.CSSProperties {
  if (usage === "CUSTOMER_ASSIGNABLE") {
    return { ...badgeBase, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
  }
  if (usage === "RUN_BASE_ONLY") {
    return { ...badgeBase, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
  }
  return { ...badgeBase, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#475569" };
}

function usageLabel(usage: "CUSTOMER_ASSIGNABLE" | "RUN_BASE_ONLY" | "HIDDEN") {
  if (usage === "CUSTOMER_ASSIGNABLE") return "Asignable";
  if (usage === "RUN_BASE_ONLY") return "Solo base";
  return "Oculto";
}
