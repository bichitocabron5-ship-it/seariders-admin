"use client";

import type React from "react";

export default function AdminUsersFiltersSection({
  q,
  active,
  inputStyle,
  cardStyle,
  onQueryChange,
  onActiveChange,
}: {
  q: string;
  active: "" | "true" | "false";
  inputStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  onQueryChange: (value: string) => void;
  onActiveChange: (value: "" | "true" | "false") => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>Filtros</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Buscar
          <input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Nombre, username, email o código"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Estado
          <select value={active} onChange={(e) => onActiveChange(e.target.value as "" | "true" | "false")} style={inputStyle}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
      </div>
    </section>
  );
}
