// src/app/platform/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlatformBoard from "./_components/PlatformBoard";

type BoardOption = {
  key: "JETSKI" | "NAUTICA";
  title: string;
  kind: "JETSKI" | "NAUTICA";
  categories: string[];
};

const BOARD_OPTIONS: BoardOption[] = [
  {
    key: "JETSKI",
    title: "Plataforma - Jetski",
    kind: "JETSKI",
    categories: ["JETSKI"],
  },
  {
    key: "NAUTICA",
    title: "Plataforma - Nautica",
    kind: "NAUTICA",
    categories: ["TOWABLE", "WAKEBOARD", "FLYBOARD", "PARASAILING", "JETCAR", "BOAT"],
  },
];

export default function PlatformPage() {
  const [selected, setSelected] = useState<BoardOption["key"]>("JETSKI");

  const board = useMemo(
    () => BOARD_OPTIONS.find((b) => b.key === selected) || BOARD_OPTIONS[0],
    [selected]
  );

  return (
    <div style={{ padding: 24, maxWidth: 1480, margin: "0 auto", display: "grid", gap: 18 }}>
      <section
        style={{
          border: "1px solid #dbe4ea",
          borderRadius: 28,
          padding: 24,
          background:
            "radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%), radial-gradient(circle at right bottom, rgba(99, 102, 241, 0.16), transparent 24%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #312e81 100%)",
          color: "#e0e7ff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#93c5fd" }}>
              Platform
            </div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: "#fff" }}>Operativa de plataforma</h1>
            <div style={{ fontSize: 14, color: "#c7d2fe" }}>
              Cola operativa, asignaciones, salidas, cierre de actividades e incidencias de flota en una sola vista.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/operations" style={ghostLink}>
              Centro operativo
            </Link>
            <Link href="/admin" style={ghostLink}>
              Admin
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BOARD_OPTIONS.map((option) => {
            const active = option.key === selected;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option.key)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "#111827" : "rgba(191, 219, 254, 0.25)"}`,
                  background: active ? "#fff" : "rgba(15, 23, 42, 0.26)",
                  color: active ? "#111827" : "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {option.key === "JETSKI" ? "Jetski" : "Nautica"}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPillStyle}>Vista: {board.key === "JETSKI" ? "Jetski" : "Nautica"}</span>
          <span style={heroPillStyle}>Categorias: {board.categories.length}</span>
        </div>
      </section>

      <div>
        <PlatformBoard title={board.title} kind={board.kind} categories={board.categories} />
      </div>
    </div>
  );
}

const ghostLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(191, 219, 254, 0.28)",
  background: "rgba(255,255,255,0.92)",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
};

const heroPillStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(125, 211, 252, 0.35)",
  background: "rgba(15, 23, 42, 0.24)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
};
