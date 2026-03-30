"use client";

import type { CSSProperties } from "react";

type SeverityColors = {
  bg: string;
  border: string;
  text: string;
};

type SummaryTile = {
  title: string;
  value: string;
  target: string;
  severityLabel: string;
  colors: SeverityColors;
};

type AlertCard = {
  key: string;
  href: string;
  label: string;
  phase: string;
  waited: string;
  target: string;
  overBy: string;
  severityLabel: string;
  colors: SeverityColors;
};

type ActiveWaitRow = {
  reserva: string;
  fase: string;
  actual: string;
  sla: string;
  retraso: string;
  desde: string;
  prevista: string;
  severityColors: SeverityColors;
  href: string;
};

type PhaseSummaryRow = {
  fase: string;
  media: string;
  max: string;
  casos: string;
  sla: string;
  cumplimiento: string;
  severityColors: SeverityColors;
};

export default function WaitTimesSection({
  loading,
  error,
  generatedAtLabel,
  summaryTiles,
  overview,
  alertCards,
  activeWaitRows,
  phaseSummaryRows,
}: {
  loading: boolean;
  error: string | null;
  generatedAtLabel: string | null;
  summaryTiles: SummaryTile[];
  overview: {
    criticalWaitAlerts: number;
    activeAlerts: number;
    unitsReadyWithoutAssignment: number;
    assignments: number;
    reservations: number;
  } | null;
  alertCards: AlertCard[];
  activeWaitRows: ActiveWaitRow[];
  phaseSummaryRows: PhaseSummaryRow[];
}) {
  if (loading) {
    return <div style={infoText}>Cargando tiempos operativos...</div>;
  }

  if (error) {
    return <div style={errorBox}>{error}</div>;
  }

  if (!overview) return null;

  return (
    <>
      {generatedAtLabel ? (
        <div style={metaText}>Control live de Booth, Store, Platform y servicio en mar. | Actualizado {generatedAtLabel}</div>
      ) : (
        <div style={metaText}>Control live de Booth, Store, Platform y servicio en mar.</div>
      )}

      <div style={summaryGrid}>
        {summaryTiles.map((item) => (
          <div
            key={item.title}
            style={{
              border: `1px solid ${item.colors.border}`,
              background: item.colors.bg,
              borderRadius: 16,
              padding: 14,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={tileLabel}>{item.title}</div>
              <span
                style={{
                  border: `1px solid ${item.colors.border}`,
                  background: "#fff",
                  color: item.colors.text,
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {item.severityLabel}
              </span>
            </div>

            <div style={tileValue}>{item.value}</div>

            <div style={{ fontSize: 12, color: item.colors.text, fontWeight: 800 }}>
              SLA: {item.target}
            </div>
          </div>
        ))}
      </div>

      <div style={tripleGrid}>
        <div style={panelCard}>
          <div style={panelTitle}>Resumen ejecutivo</div>
          <div style={kpiGrid}>
            <InlineKpi title="Alertas SLA" value={overview.criticalWaitAlerts} warn={overview.criticalWaitAlerts > 0} />
            <InlineKpi title="Alertas activas" value={overview.activeAlerts} warn={overview.activeAlerts > 0} />
            <InlineKpi
              title="Sin asignación Platform"
              value={overview.unitsReadyWithoutAssignment}
              warn={overview.unitsReadyWithoutAssignment > 0}
            />
            <InlineKpi title="Assignments" value={overview.assignments} />
          </div>
        </div>

        <div style={alertPanel}>
          <div style={{ ...panelTitle, color: "#7f1d1d" }}>Alertas SLA</div>

          {alertCards.length === 0 ? (
            <div style={emptyText}>No hay alertas de espera fuera de SLA ahora mismo.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {alertCards.map((row) => (
                <a
                  key={row.key}
                  href={row.href}
                  style={{
                    border: `1px solid ${row.colors.border}`,
                    background: row.colors.bg,
                    color: row.colors.text,
                    borderRadius: 12,
                    padding: 10,
                    display: "grid",
                    gap: 4,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{row.label}</div>
                    <span
                      style={{
                        border: `1px solid ${row.colors.border}`,
                        background: "#fff",
                        color: row.colors.text,
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {row.severityLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: 13 }}>
                    {row.phase} · esperando {row.waited} · SLA {row.target}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                    Retraso: {row.overBy}
                  </div>

                  <div style={{ fontSize: 12, textDecoration: "underline" }}>
                    Abrir reserva / área
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={panelCard}>
          <div style={panelTitle}>Resumen live</div>
          <div style={liveGrid}>
            <InlineKpi title="Reservas hoy" value={overview.reservations} />
            <InlineKpi
              title="Sin asignación Platform"
              value={overview.unitsReadyWithoutAssignment}
              warn={overview.unitsReadyWithoutAssignment > 0}
            />
            <InlineKpi title="Alertas activas" value={overview.activeAlerts} warn={overview.activeAlerts > 0} />
            <InlineKpi title="Assignments" value={overview.assignments} />
          </div>
        </div>
      </div>

      <div style={panelCard}>
        <div style={panelTitle}>Top esperas activas</div>

        {activeWaitRows.length === 0 ? (
          <div style={emptyText}>No hay esperas activas relevantes.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadRow}>
                  <th style={thCell}>Reserva</th>
                  <th style={thCell}>Fase</th>
                  <th style={{ ...thCell, textAlign: "right" }}>Actual</th>
                  <th style={{ ...thCell, textAlign: "right" }}>SLA</th>
                  <th style={{ ...thCell, textAlign: "right" }}>Retraso</th>
                  <th style={thCell}>Desde</th>
                  <th style={thCell}>Hora prevista</th>
                </tr>
              </thead>
              <tbody>
                {activeWaitRows.map((row, idx) => (
                  <tr key={`${row.reserva}-${row.fase}-${idx}`} style={tbodyRow}>
                    <td style={{ ...tdCell, fontWeight: 800 }}>
                      <a href={row.href} style={tableLink}>
                        {row.reserva}
                      </a>
                    </td>
                    <td style={tdCell}>{row.fase}</td>
                    <td style={{ ...tdCell, textAlign: "right" }}>{row.actual}</td>
                    <td style={{ ...tdCell, textAlign: "right" }}>{row.sla}</td>
                    <td style={{ ...tdCell, textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `1px solid ${row.severityColors.border}`,
                          background: row.severityColors.bg,
                          color: row.severityColors.text,
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontWeight: 900,
                          minWidth: 82,
                        }}
                      >
                        {row.retraso}
                      </span>
                    </td>
                    <td style={tdCell}>{row.desde}</td>
                    <td style={tdCell}>{row.prevista}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={panelCard}>
        <div style={panelTitle}>Resumen por fase</div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRow}>
                <th style={thCell}>Fase</th>
                <th style={{ ...thCell, textAlign: "right" }}>Media</th>
                <th style={{ ...thCell, textAlign: "right" }}>Max</th>
                <th style={{ ...thCell, textAlign: "right" }}>Casos</th>
                <th style={{ ...thCell, textAlign: "right" }}>SLA</th>
                <th style={{ ...thCell, textAlign: "right" }}>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {phaseSummaryRows.map((row, idx) => (
                <tr key={`${row.fase}-${idx}`} style={tbodyRow}>
                  <td style={{ ...tdCell, fontWeight: 800 }}>{row.fase}</td>
                  <td style={{ ...tdCell, textAlign: "right" }}>{row.media}</td>
                  <td style={{ ...tdCell, textAlign: "right" }}>{row.max}</td>
                  <td style={{ ...tdCell, textAlign: "right" }}>{row.casos}</td>
                  <td style={{ ...tdCell, textAlign: "right" }}>{row.sla}</td>
                  <td style={{ ...tdCell, textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${row.severityColors.border}`,
                        background: row.severityColors.bg,
                        color: row.severityColors.text,
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontWeight: 900,
                        minWidth: 76,
                      }}
                    >
                      {row.cumplimiento}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function InlineKpi({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{ ...kpiCard, ...(warn ? kpiWarn : null) }}>
      <div style={kpiTitle}>{title}</div>
      <div style={{ ...kpiValue, color: warn ? "#b45309" : "#111827" }}>{value}</div>
    </div>
  );
}

const infoText: CSSProperties = {
  color: "#475569",
  fontWeight: 700,
};

const errorBox: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};

const metaText: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const tileLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
};

const tileValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const tripleGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const panelCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const alertPanel: CSSProperties = {
  ...panelCard,
  border: "1px solid #fee2e2",
  background: "#fffafa",
};

const panelTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
};

const emptyText: CSSProperties = {
  fontSize: 13,
  color: "#475569",
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const liveGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const kpiCard: CSSProperties = {
  border: "1px solid #dde4ee",
  background: "#fff",
  borderRadius: 18,
  padding: 14,
};

const kpiWarn: CSSProperties = {
  borderColor: "#f7d58d",
  background: "#fff8e8",
};

const kpiTitle: CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
  fontWeight: 800,
};

const kpiValue: CSSProperties = {
  marginTop: 6,
  fontSize: 26,
  fontWeight: 950,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const theadRow: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
};

const tbodyRow: CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
};

const thCell: CSSProperties = {
  padding: "10px 8px",
};

const tdCell: CSSProperties = {
  padding: "10px 8px",
};

const tableLink: CSSProperties = {
  color: "#0f172a",
  textDecoration: "underline",
  fontWeight: 800,
};
