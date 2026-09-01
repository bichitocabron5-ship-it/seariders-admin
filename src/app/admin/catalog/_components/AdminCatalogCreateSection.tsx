"use client";

import type { CSSProperties } from "react";

export default function AdminCatalogCreateSection({
  name,
  category,
  isExternalActivity,
  visibleInStore,
  visibleInBooth,
  visibleInWeb,
  inputStyle,
  fieldLabel,
  toggleRow,
  darkBtn,
  panelStyle,
  onNameChange,
  onCategoryChange,
  onExternalActivityChange,
  onVisibleInStoreChange,
  onVisibleInBoothChange,
  onVisibleInWebChange,
  onCreate,
}: {
  name: string;
  category: string;
  isExternalActivity: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  visibleInWeb: boolean;
  inputStyle: CSSProperties;
  fieldLabel: CSSProperties;
  toggleRow: CSSProperties;
  darkBtn: CSSProperties;
  panelStyle: CSSProperties;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onExternalActivityChange: (value: boolean) => void;
  onVisibleInStoreChange: (value: boolean) => void;
  onVisibleInBoothChange: (value: boolean) => void;
  onVisibleInWebChange: (value: boolean) => void;
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
          Si la categoria es <strong>EXTRA</strong>, el servicio no tendra opciones de duracion o pax.
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
            Categoria
            <input
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              placeholder="JETSKI, BOAT, EXTRA..."
              style={inputStyle}
            />
          </label>

          <label style={toggleRow}>
            <input
              type="checkbox"
              checked={isExternalActivity}
              onChange={(e) => onExternalActivityChange(e.target.checked)}
            />
            Actividad externa
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
              Visibilidad
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={toggleRow}>
                <input
                  type="checkbox"
                  checked={visibleInStore}
                  onChange={(e) => onVisibleInStoreChange(e.target.checked)}
                />
                Store
              </label>
              <label style={toggleRow}>
                <input
                  type="checkbox"
                  checked={visibleInBooth}
                  onChange={(e) => onVisibleInBoothChange(e.target.checked)}
                />
                Booth
              </label>
              <label style={toggleRow}>
                <input
                  type="checkbox"
                  checked={visibleInWeb}
                  onChange={(e) => onVisibleInWebChange(e.target.checked)}
                />
                WEB
              </label>
            </div>
          </div>

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
