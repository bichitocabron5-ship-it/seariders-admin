"use client";

import type React from "react";

import type { AssetStatus, AssetType } from "../../types";

export default function AdminAssetsFiltersSection({
  q,
  type,
  status,
  assetTypes,
  assetStatuses,
  inputStyle,
  onQueryChange,
  onTypeChange,
  onStatusChange,
  cardStyle,
}: {
  q: string;
  type: "" | AssetType;
  status: "" | AssetStatus;
  assetTypes: AssetType[];
  assetStatuses: AssetStatus[];
  inputStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: "" | AssetType) => void;
  onStatusChange: (value: "" | AssetStatus) => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>Filtros</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Buscar
          <input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Nombre, código, matrícula, bastidor o modelo"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Tipo
          <select value={type} onChange={(e) => onTypeChange(e.target.value as "" | AssetType)} style={inputStyle}>
            <option value="">Todos</option>
            {assetTypes.map((assetType) => (
              <option key={assetType} value={assetType}>
                {assetType}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Estado
          <select value={status} onChange={(e) => onStatusChange(e.target.value as "" | AssetStatus)} style={inputStyle}>
            <option value="">Todos</option>
            {assetStatuses.map((assetStatus) => (
              <option key={assetStatus} value={assetStatus}>
                {assetStatus}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
