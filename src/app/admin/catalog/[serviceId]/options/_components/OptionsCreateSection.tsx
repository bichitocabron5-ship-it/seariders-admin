"use client";

import type { CSSProperties } from "react";

type Props = {
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  formGrid: CSSProperties;
  fieldStyle: CSSProperties;
  inputStyle: CSSProperties;
  darkBtn: CSSProperties;
  dur: number;
  pax: number;
  contracted: number;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  creating: boolean;
  onDurChange: (value: number) => void;
  onPaxChange: (value: number) => void;
  onContractedChange: (value: number) => void;
  onVisibleInStoreChange: (value: boolean) => void;
  onVisibleInBoothChange: (value: boolean) => void;
  onCreate: () => void | Promise<void>;
};

export default function OptionsCreateSection({
  panelStyle,
  panelHeader,
  formGrid,
  fieldStyle,
  inputStyle,
  darkBtn,
  dur,
  pax,
  contracted,
  visibleInStore,
  visibleInBooth,
  creating,
  onDurChange,
  onPaxChange,
  onContractedChange,
  onVisibleInStoreChange,
  onVisibleInBoothChange,
  onCreate,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Crear opción</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Define la ficha operativa base. El precio se edita en la pantalla de precios.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={formGrid}>
          <label style={fieldStyle}>
            Duración (min)
            <input
              type="number"
              min={1}
              max={600}
              value={dur}
              onChange={(e) => onDurChange(Number(e.target.value || 0))}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            PAX máx.
            <input
              type="number"
              min={1}
              max={30}
              value={pax}
              onChange={(e) => onPaxChange(Number(e.target.value || 0))}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            Minutos contratados
            <input
              type="number"
              min={1}
              max={600}
              value={contracted}
              onChange={(e) => onContractedChange(Number(e.target.value || 0))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...fieldStyle, justifyContent: "end" }}>
            Visibilidad
            <span style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={visibleInStore}
                  onChange={(e) => onVisibleInStoreChange(e.target.checked)}
                />
                Visible en Store
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={visibleInBooth}
                  onChange={(e) => onVisibleInBoothChange(e.target.checked)}
                />
                Visible en Booth
              </label>
            </span>
          </label>

          <div style={{ display: "grid", alignItems: "end" }}>
            <button type="button" onClick={() => void onCreate()} style={darkBtn} disabled={creating}>
              {creating ? "Creando..." : "Añadir opción"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
