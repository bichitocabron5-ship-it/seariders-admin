// src/app/mechanics/parts/_components/ui.tsx
"use client";

import { type CSSProperties, type ReactNode } from "react";

export const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
};

export const modalGrid2: CSSProperties = {
  marginTop: 4,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

export const ghostBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #d0d9e4",
  background: "#fff",
  fontWeight: 900,
};

export const primaryBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};

export const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

export const sectionCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)",
  padding: 14,
};

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 70,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(860px, 100%)",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: 20,
          border: "1px solid #dbe4ea",
          boxShadow: "0 22px 48px rgba(15, 23, 42, 0.14)",
          padding: 16,
          display: "grid",
          gap: 14,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}

export function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}
