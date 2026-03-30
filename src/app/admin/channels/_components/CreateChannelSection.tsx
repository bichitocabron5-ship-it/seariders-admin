"use client";

import type { CSSProperties } from "react";

type Props = {
  newName: string;
  newIsActive: boolean;
  newCommissionEnabled: boolean;
  newCommissionPct: string;
  creating: boolean;
  setNewName: (value: string) => void;
  setNewIsActive: (value: boolean) => void;
  setNewCommissionEnabled: (value: boolean) => void;
  setNewCommissionPct: (value: string) => void;
  createChannel: () => void | Promise<void>;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  controlsGrid: CSSProperties;
  inputStyle: CSSProperties;
  darkBtn: CSSProperties;
};

export default function CreateChannelSection({
  newName,
  newIsActive,
  newCommissionEnabled,
  newCommissionPct,
  creating,
  setNewName,
  setNewIsActive,
  setNewCommissionEnabled,
  setNewCommissionPct,
  createChannel,
  panelStyle,
  panelHeader,
  controlsGrid,
  inputStyle,
  darkBtn,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Crear canal</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Alta rápida de un canal comercial con estado y comisión base inicial.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={controlsGrid}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Nombre del canal
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Booking, GetYourGuide, Brutal"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Comisión base (%)
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={newCommissionPct}
              onChange={(e) => setNewCommissionPct(e.target.value)}
              style={inputStyle}
              disabled={!newCommissionEnabled}
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={newCommissionEnabled}
              onChange={(e) => {
                setNewCommissionEnabled(e.target.checked);
                if (!e.target.checked) setNewCommissionPct("0");
              }}
            />
            Comisión activa
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
            Canal activo
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => void createChannel()} disabled={creating} style={darkBtn}>
            {creating ? "Creando..." : "Crear canal"}
          </button>
        </div>
      </div>
    </section>
  );
}
