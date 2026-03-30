"use client";

import type React from "react";

export const executiveStyles = {
  heroStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  } as React.CSSProperties,
  metaGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  } as React.CSSProperties,
  metaBadge: {
    border: "1px solid #dbe4ea",
    borderRadius: 16,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.88)",
    display: "grid",
    gap: 4,
    minWidth: 140,
  } as React.CSSProperties,
  metaLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#64748b",
  } as React.CSSProperties,
  metaValue: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  } as React.CSSProperties,
  heroStatCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 22,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 6,
    minHeight: 118,
  } as React.CSSProperties,
  sectionCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 24,
    padding: 18,
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    boxShadow: "0 16px 38px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 14,
    alignContent: "start",
    height: "100%",
  } as React.CSSProperties,
  sectionHeader: {
    paddingBottom: 12,
    borderBottom: "1px solid #edf2f7",
  } as React.CSSProperties,
  sectionTitle: {
    fontWeight: 950,
    fontSize: 20,
    color: "#0f172a",
  } as React.CSSProperties,
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } as React.CSSProperties,
  metricValue: {
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1.1,
  } as React.CSSProperties,
  heroValue: {
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1.05,
  } as React.CSSProperties,
  detail: {
    fontSize: 13,
    color: "#64748b",
  } as React.CSSProperties,
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  } as React.CSSProperties,
  metricCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 18,
    padding: 14,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    display: "grid",
    gap: 6,
    minHeight: 98,
  } as React.CSSProperties,
  briefGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  } as React.CSSProperties,
  briefCard: {
    border: "1px solid #dbe4ea",
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    display: "grid",
    gap: 8,
    minHeight: 112,
  } as React.CSSProperties,
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
    gap: 20,
    alignItems: "stretch",
  } as React.CSSProperties,
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20,
    alignItems: "stretch",
  } as React.CSSProperties,
  chartLarge: {
    width: "100%",
    height: 360,
  } as React.CSSProperties,
  chartMedium: {
    width: "100%",
    height: 300,
  } as React.CSSProperties,
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#fff",
  } as React.CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse",
  } as React.CSSProperties,
  th: {
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  } as React.CSSProperties,
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    color: "#0f172a",
  } as React.CSSProperties,
  empty: {
    padding: 18,
    textAlign: "center",
    color: "#64748b",
  } as React.CSSProperties,
  tooltip: {
    border: "1px solid #dbe4ea",
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
    padding: 12,
  } as React.CSSProperties,
  tooltipRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginTop: 6,
    fontSize: 13,
  } as React.CSSProperties,
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  } as React.CSSProperties,
};

export function ExecutiveSection(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={executiveStyles.sectionCard}>
      <div style={executiveStyles.sectionHeader}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={executiveStyles.sectionTitle}>{props.title}</div>
          <div style={executiveStyles.sectionSubtitle}>{props.subtitle}</div>
        </div>
      </div>
      {props.children}
    </section>
  );
}

export function ExecutiveMetricCard(props: { title: string; value: string; warn?: boolean }) {
  return (
    <div
      style={{
        ...executiveStyles.metricCard,
        borderColor: props.warn ? "#fde68a" : "#dbe4ea",
        background: props.warn
          ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)"
          : executiveStyles.metricCard.background,
      }}
    >
      <div style={executiveStyles.label}>{props.title}</div>
      <div style={{ ...executiveStyles.metricValue, color: props.warn ? "#92400e" : "#0f172a" }}>
        {props.value}
      </div>
    </div>
  );
}

export function ExecutiveHeroStat(props: { label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div
      style={{
        ...executiveStyles.heroStatCard,
        borderColor: props.danger ? "#fecaca" : "#dbe4ea",
        background: props.danger
          ? "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)"
          : executiveStyles.heroStatCard.background,
      }}
    >
      <div style={executiveStyles.label}>{props.label}</div>
      <div style={{ ...executiveStyles.heroValue, color: props.danger ? "#b91c1c" : "#0f172a" }}>
        {props.value}
      </div>
      <div style={executiveStyles.detail}>{props.detail}</div>
    </div>
  );
}

export function ExecutiveBriefCard(props: {
  title: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        ...executiveStyles.briefCard,
        borderColor: props.warn ? "#fde68a" : "#dbe4ea",
        background: props.warn
          ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)"
          : executiveStyles.briefCard.background,
      }}
    >
      <div style={executiveStyles.label}>{props.title}</div>
      <div style={{ ...executiveStyles.metricValue, color: props.warn ? "#92400e" : "#0f172a" }}>
        {props.value}
      </div>
      <div style={executiveStyles.detail}>{props.detail}</div>
    </div>
  );
}

export function ExecutiveMetaBadge(props: { label: string; value: string }) {
  return (
    <div style={executiveStyles.metaBadge}>
      <div style={executiveStyles.metaLabel}>{props.label}</div>
      <div style={executiveStyles.metaValue}>{props.value}</div>
    </div>
  );
}

export function ExecutiveDataTable(props: {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string>>;
}) {
  return (
    <div style={executiveStyles.tableWrap}>
      <table style={executiveStyles.table}>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th
                key={column.key}
                style={{ ...executiveStyles.th, textAlign: column.align === "right" ? "right" : "left" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td colSpan={props.columns.length} style={executiveStyles.empty}>Sin datos.</td>
            </tr>
          ) : (
            props.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {props.columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ ...executiveStyles.td, textAlign: column.align === "right" ? "right" : "left" }}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ExecutiveChartTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  formatValue?: (name: string, value: number | string | undefined) => string;
}) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div style={executiveStyles.tooltip}>
      {props.label ? <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.label}</div> : null}
      {props.payload.map((item, index) => {
        const name = String(item.name ?? `Serie ${index + 1}`);
        const rendered = props.formatValue
          ? props.formatValue(name, item.value)
          : String(item.value ?? "-");
        return (
          <div key={`${name}-${index}`} style={executiveStyles.tooltipRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...executiveStyles.dot, background: item.color ?? "#0f172a" }} />
              <span>{name}</span>
            </div>
            <strong>{rendered}</strong>
          </div>
        );
      })}
    </div>
  );
}
