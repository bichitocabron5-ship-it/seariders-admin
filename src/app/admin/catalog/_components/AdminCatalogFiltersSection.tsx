"use client";

import type { CSSProperties } from "react";

export default function AdminCatalogFiltersSection({
  q,
  cat,
  categories,
  showInactive,
  filteredCount,
  inputStyle,
  fieldLabel,
  toggleRow,
  panelStyle,
  onQueryChange,
  onCategoryChange,
  onShowInactiveChange,
}: {
  q: string;
  cat: string;
  categories: string[];
  showInactive: boolean;
  filteredCount: number;
  inputStyle: CSSProperties;
  fieldLabel: CSSProperties;
  toggleRow: CSSProperties;
  panelStyle: CSSProperties;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onShowInactiveChange: (value: boolean) => void;
}) {
  return (
    <section style={panelStyle}>
      <div style={{ fontWeight: 950 }}>Filtros</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <label style={fieldLabel}>
          Buscar servicio
          <input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Jetski, barco, licencia..."
            style={inputStyle}
          />
        </label>

        <label style={fieldLabel}>
          Categoría
          <select value={cat} onChange={(e) => onCategoryChange(e.target.value)} style={inputStyle}>
            <option value="ALL">Todas las categorías</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label style={{ ...fieldLabel, justifyContent: "end" }}>
          Visibilidad
          <span style={toggleRow}>
            <input type="checkbox" checked={showInactive} onChange={(e) => onShowInactiveChange(e.target.checked)} />
            Mostrar inactivos
          </span>
        </label>
      </div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{filteredCount} servicios en la vista actual</div>
    </section>
  );
}
