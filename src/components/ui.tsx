"use client";

import React from "react";

export const styles = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui",
    display: "grid",
    gap: 18,
  } as React.CSSProperties,

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  } as React.CSSProperties,

  h1: { margin: 0, fontSize: 28, fontWeight: 950, lineHeight: 1 } as React.CSSProperties,
  muted: { fontSize: 12, color: "#64748b" } as React.CSSProperties,
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" } as React.CSSProperties,

  card: {
    border: "1px solid #dbe4ea",
    borderRadius: 20,
    background: "white",
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  } as React.CSSProperties,

  cardHeader: {
    padding: "16px 18px",
    background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  } as React.CSSProperties,

  cardBody: { padding: 18 } as React.CSSProperties,

  sectionTitle: { fontWeight: 900, fontSize: 15, color: "#0f172a" } as React.CSSProperties,

  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 } as React.CSSProperties,
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d0d9e4",
    background: "white",
    outline: "none",
    fontSize: 14,
  } as React.CSSProperties,

  select: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d0d9e4",
    background: "white",
    outline: "none",
    fontSize: 14,
  } as React.CSSProperties,

  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #d0d9e4",
    background: "white",
    fontWeight: 900,
    cursor: "pointer",
    color: "#111827",
  } as React.CSSProperties,

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  } as React.CSSProperties,

  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #b91c1c",
    background: "#b91c1c",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  } as React.CSSProperties,

  pill: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid #dbe4ea",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  hr: { borderTop: "1px dashed #dbe4ea", margin: "12px 0" } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  } as React.CSSProperties,

  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
  } as React.CSSProperties,

  td: { padding: "12px 10px", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,
};

export function Page(props: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.page}>
      {(props.title || props.right) && (
        <div style={styles.topbar}>
          <div style={styles.h1}>{props.title ?? ""}</div>
          <div>{props.right}</div>
        </div>
      )}
      {props.children}
    </div>
  );
}

export function Card(props: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      {(props.title || props.right) && (
        <div style={styles.cardHeader}>
          <div style={styles.sectionTitle}>{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      <div style={styles.cardBody}>{props.children}</div>
    </div>
  );
}

export function Pill(props: { children: React.ReactNode; bg?: string; border?: string }) {
  return (
    <span
      style={{
        ...styles.pill,
        background: props.bg ?? styles.pill.background,
        border: `1px solid ${props.border ?? "#e5e7eb"}`,
      }}
    >
      {props.children}
    </span>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "primary" | "danger" }) {
  const base = props.variant === "primary" ? styles.btnPrimary : props.variant === "danger" ? styles.btnDanger : styles.btn;
  const opacity = props.disabled ? 0.55 : 1;
  return <button {...props} type={props.type ?? "button"} style={{ ...base, opacity, ...(props.style as React.CSSProperties) }} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...styles.input, ...(props.style as React.CSSProperties) }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...styles.select, ...(props.style as React.CSSProperties) }} />;
}

export function Alert(props: { kind?: "error" | "info"; children: React.ReactNode }) {
  const isErr = props.kind === "error";
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        border: `1px solid ${isErr ? "#fecaca" : "#dbe4ea"}`,
        background: isErr ? "#fff1f2" : "#f8fafc",
        color: isErr ? "#991b1b" : "#334155",
      }}
    >
      {props.children}
    </div>
  );
}

export function Stat(props: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #dbe4ea", borderRadius: 16, padding: 14, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 800 }}>{props.label}</div>
      <div style={{ fontWeight: 950, fontSize: 20 }}>{props.value}</div>
    </div>
  );
}

export function Table(props: { head: string[]; rows: Array<React.ReactNode[]> }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {props.head.map((h, i) => (
              <th key={i} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={styles.td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
