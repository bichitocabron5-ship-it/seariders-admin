"use client";

import type React from "react";

export default function SlotsCapacitySection({
  dataLoaded,
  loading,
  categories,
  limitsMap,
  inputStyle,
  cardStyle,
  limitBadge,
  onLimitChange,
}: {
  dataLoaded: boolean;
  loading: boolean;
  categories: string[];
  limitsMap: Record<string, number>;
  inputStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  limitBadge: React.CSSProperties;
  onLimitChange: (category: string, value: number) => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 950, fontSize: 20 }}>Capacidad por categoría</div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{categories.length} categoría(s)</div>
      </div>

      {!dataLoaded ? (
        <div style={{ opacity: 0.7 }}>{loading ? "Cargando..." : "Sin datos"}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {categories.map((category) => (
            <div
              key={category}
              style={{
                border: "1px solid #e5edf4",
                borderRadius: 18,
                padding: 14,
                background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)",
                display: "grid",
                gridTemplateColumns: "minmax(180px, 240px) 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 950 }}>{category}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {category === "JETSKI" ? "Referencia inicial recomendada: 10" : "Referencia inicial: 1"}
                </div>
              </div>

              <input
                type="number"
                min={0}
                max={999}
                value={limitsMap[category] ?? 0}
                onChange={(e) => onLimitChange(category, Number(e.target.value))}
                style={{ ...inputStyle, maxWidth: 180 }}
              />

              <span style={limitBadge}>{Number(limitsMap[category] ?? 0)} ud.</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
