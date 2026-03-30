"use client";

import type { CSSProperties } from "react";

type ServiceLite = {
  id: string;
  name: string;
  category: string;
  options: Array<{ id: string; name?: string | null; durationMinutes?: number | null; pax?: number | null }>;
};

type Props = {
  panelStyle: CSSProperties;
  inputStyle: CSSProperties;
  darkBtn: CSSProperties;
  services: ServiceLite[];
  serviceOptions: ServiceLite["options"];
  pServiceId: string;
  pOptionId: string;
  pName: string;
  pPriceEuros: string;
  pValidDays: string;
  pActive: boolean;
  optLabel: (option: ServiceLite["options"][number]) => string;
  onServiceChange: (value: string) => void;
  onOptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onValidDaysChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
  onCreate: () => void | Promise<void>;
};

export default function GiftProductsCreateSection({
  panelStyle,
  inputStyle,
  darkBtn,
  services,
  serviceOptions,
  pServiceId,
  pOptionId,
  pName,
  pPriceEuros,
  pValidDays,
  pActive,
  optLabel,
  onServiceChange,
  onOptionChange,
  onNameChange,
  onPriceChange,
  onValidDaysChange,
  onActiveChange,
  onCreate,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>
        Crear producto regalo
      </div>

      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        <label style={{ fontSize: 13 }}>
          Actividad
          <select value={pServiceId} onChange={(e) => onServiceChange(e.target.value)} style={inputStyle}>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.category} · {service.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Opción
          <select value={pOptionId} onChange={(e) => onOptionChange(e.target.value)} style={inputStyle}>
            {serviceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {optLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          Nombre visible (opcional)
          <input
            value={pName}
            onChange={(e) => onNameChange(e.target.value)}
            style={inputStyle}
            placeholder="Ej: Regalo Moto 20 min"
          />
        </label>

        <label style={{ fontSize: 13 }}>
          PVP (EUR)
          <input value={pPriceEuros} onChange={(e) => onPriceChange(e.target.value)} style={inputStyle} placeholder="75" />
        </label>

        <label style={{ fontSize: 13 }}>
          Validez en días (opcional)
          <input
            value={pValidDays}
            onChange={(e) => onValidDaysChange(e.target.value)}
            style={inputStyle}
            placeholder="365"
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={pActive} onChange={(e) => onActiveChange(e.target.checked)} />
          Activo
        </label>

        <button onClick={() => void onCreate()} style={darkBtn}>
          Crear producto
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Consejo: usa el nombre opcional solo si quieres un nombre comercial distinto; si no, se genera desde
          actividad y opción.
        </div>
      </div>
    </div>
  );
}
