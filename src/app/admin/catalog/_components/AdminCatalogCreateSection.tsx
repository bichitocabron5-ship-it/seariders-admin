"use client";

import type { CSSProperties } from "react";

export default function AdminCatalogCreateSection({
  name,
  category,
  inputStyle,
  fieldLabel,
  darkBtn,
  panelStyle,
  onNameChange,
  onCategoryChange,
  onCreate,
}: {
  name: string;
  category: string;
  inputStyle: CSSProperties;
  fieldLabel: CSSProperties;
  darkBtn: CSSProperties;
  panelStyle: CSSProperties;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid #eef2f7",
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 950 }}>Crear servicio</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Si la categoría es <strong>EXTRA</strong>, el servicio no tendrá opciones de duración o pax.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={fieldLabel}>
            Nombre
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej. Jetski turista"
              style={inputStyle}
            />
          </label>

          <label style={fieldLabel}>
            Categoría
            <input
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              placeholder="JETSKI, BOAT, EXTRA..."
              style={inputStyle}
            />
          </label>

          <div style={{ display: "grid", alignItems: "end" }}>
            <button type="button" onClick={onCreate} style={darkBtn}>
              Crear servicio
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
