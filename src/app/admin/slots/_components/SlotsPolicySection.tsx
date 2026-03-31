"use client";

import type React from "react";

export default function SlotsPolicySection({
  intervalMinutes,
  openTime,
  closeTime,
  inputStyle,
  cardStyle,
  onIntervalChange,
  onOpenTimeChange,
  onCloseTimeChange,
}: {
  intervalMinutes: number;
  openTime: string;
  closeTime: string;
  inputStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  onIntervalChange: (value: number) => void;
  onOpenTimeChange: (value: string) => void;
  onCloseTimeChange: (value: string) => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 20 }}>Política de slots</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Intervalo (minutos)
          <input
            type="number"
            min={5}
            max={240}
            value={intervalMinutes}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Apertura
          <input type="time" value={openTime} onChange={(e) => onOpenTimeChange(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Cierre
          <input type="time" value={closeTime} onChange={(e) => onCloseTimeChange(e.target.value)} style={inputStyle} />
        </label>
      </div>
    </section>
  );
}
