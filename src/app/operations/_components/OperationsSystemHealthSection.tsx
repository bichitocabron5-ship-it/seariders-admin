"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type HealthItem = {
  key: string;
  type: "force_ready_followup" | "force_depart" | "close_run";
  severity: "critical" | "warn" | "info";
  title: string;
  subtitle: string;
  detail: string;
  href: string;
  entityId: string;
  targetMin: number;
  waitedMin: number;
  overByMin: number;
};

type HealthSummary = {
  total: number;
  critical: number;
  warn: number;
  info: number;
  readyWithoutAssignment: number;
  queuedWithoutDeparture: number;
  staleReadyRuns: number;
  overdueInSeaRuns: number;
};

export default function OperationsSystemHealthSection({
  loading,
  error,
  generatedAtLabel,
  summary,
  items,
  actionBusyKey,
  onForceReady,
}: {
  loading: boolean;
  error: string | null;
  generatedAtLabel: string | null;
  summary: HealthSummary | null;
  items: HealthItem[];
  actionBusyKey: string | null;
  onForceReady: (reservationId: string) => void;
}) {
  if (loading) {
    return <div style={infoBox}>Cargando system health...</div>;
  }

  if (error) {
    return <div style={errorBox}>{error}</div>;
  }

  if (!summary) return null;

  return (
    <section style={sectionCard}>
      <div style={sectionHeaderRow}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={sectionEyebrow}>System health</div>
          <div style={sectionTitle}>Atascos y fallbacks operativos</div>
          <div style={sectionText}>
            Señales de flujo roto o bloqueado entre Store, Platform y salidas activas.
            {generatedAtLabel ? ` | Actualizado ${generatedAtLabel}` : ""}
          </div>
        </div>
      </div>

      <div style={summaryGrid}>
        <SummaryTile title="Incidencias health" value={summary.total} warn={summary.total > 0} />
        <SummaryTile title="Críticas" value={summary.critical} warn={summary.critical > 0} />
        <SummaryTile title="READY sin asignar" value={summary.readyWithoutAssignment} warn={summary.readyWithoutAssignment > 0} />
        <SummaryTile title="Asignados sin salida" value={summary.queuedWithoutDeparture} warn={summary.queuedWithoutDeparture > 0} />
        <SummaryTile title="Runs READY vacíos" value={summary.staleReadyRuns} warn={summary.staleReadyRuns > 0} />
        <SummaryTile title="Runs en mar vencidos" value={summary.overdueInSeaRuns} warn={summary.overdueInSeaRuns > 0} />
      </div>

      {items.length === 0 ? (
        <div style={emptyBox}>No hay señales de system health activas ahora mismo.</div>
      ) : (
        <div style={itemsGrid}>
          {items.map((item) => {
            const tone = severityStyles[item.severity];
            return (
              <div key={item.key} style={{ ...itemCard, borderColor: tone.border, background: tone.background }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 950, color: "#142033" }}>{item.title}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: tone.text }}>{item.subtitle}</div>
                    <div style={{ fontSize: 13, color: "#51627b" }}>{item.detail}</div>
                  </div>
                  <div style={{ ...severityPill, borderColor: tone.border, background: "#fff", color: tone.text }}>
                    {item.severity === "critical" ? "CRÍTICO" : item.severity === "warn" ? "ATENCIÓN" : "INFO"}
                  </div>
                </div>

                <div style={metaRow}>
                  <span>Objetivo: {item.targetMin} min</span>
                  <span>Actual: {item.waitedMin} min</span>
                  <span>{item.overByMin > 0 ? `Desvío +${item.overByMin} min` : "Dentro de rango"}</span>
                </div>

                <div style={actionsRow}>
                  {item.type === "force_ready_followup" ? (
                    <button
                      type="button"
                      onClick={() => onForceReady(item.entityId)}
                      disabled={actionBusyKey === item.key}
                      style={{
                        ...primaryAction,
                        opacity: actionBusyKey === item.key ? 0.7 : 1,
                      }}
                    >
                      {actionBusyKey === item.key ? "Aplicando..." : "Forzar READY"}
                    </button>
                  ) : null}

                  <a href={item.href} style={secondaryLink}>
                    {item.type === "force_depart" ? "Ir a forzar salida" : "Ir a revisar / cerrar"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryTile({
  title,
  value,
  warn,
}: {
  title: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div style={{ ...summaryTile, ...(warn ? summaryWarn : null) }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.72 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 950, color: warn ? "#8a5100" : "#142033" }}>
        {value}
      </div>
    </div>
  );
}

const severityStyles = {
  critical: { background: "#fff5f5", border: "#fecaca", text: "#b91c1c" },
  warn: { background: "#fff9ee", border: "#f7d58d", text: "#9a3412" },
  info: { background: "#f5f9ff", border: "#cfe0ff", text: "#1d4ed8" },
} satisfies Record<HealthItem["severity"], { background: string; border: string; text: string }>;

const sectionCard: CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #d9dee8",
  background: "rgba(255, 255, 255, 0.92)",
  display: "grid",
  gap: 16,
  boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
};

const sectionHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#6c819d",
};

const sectionTitle: CSSProperties = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 950,
  color: "#142033",
};

const sectionText: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const summaryTile: CSSProperties = {
  border: "1px solid #dde4ee",
  background: "#fff",
  borderRadius: 18,
  padding: 14,
};

const summaryWarn: CSSProperties = {
  borderColor: "#f7d58d",
  background: "#fff8e8",
};

const itemsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const itemCard: CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 12,
};

const severityPill: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const metaRow: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
};

const actionsRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryAction: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  borderRadius: 12,
};

const secondaryLink: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  borderRadius: 12,
  textAlign: "center",
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #d9dee8",
  background: "#fff",
  fontWeight: 800,
  color: "#51627b",
};

const errorBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  border: "1px dashed #d7deea",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  color: "#6c819d",
  background: "rgba(255,255,255,0.45)",
};
