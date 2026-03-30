"use client";

import type { CSSProperties } from "react";

type EmployeeKind =
  | "MONITOR"
  | "SKIPPER"
  | "SELLER"
  | "INTERN"
  | "MECHANIC"
  | "HR"
  | "SECURITY"
  | "ASSISTANT_MECHANIC"
  | "EXTRA"
  | "MANAGER";

type Props = {
  q: string;
  kind: "" | EmployeeKind;
  active: "" | "true" | "false";
  setQ: (value: string) => void;
  setKind: (value: "" | EmployeeKind) => void;
  setActive: (value: "" | "true" | "false") => void;
  load: () => void | Promise<void>;
  employeeKinds: EmployeeKind[];
  employeeKindLabel: Record<EmployeeKind, string>;
  panelStyle: CSSProperties;
  darkBtn: CSSProperties;
};

export default function EmployeesFiltersSection({
  q,
  kind,
  active,
  setQ,
  setKind,
  setActive,
  load,
  employeeKinds,
  employeeKindLabel,
  panelStyle,
  darkBtn,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 950 }}>Filtros</div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <label style={fieldLabelStyle}>
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, código, email, teléfono..."
            style={inputStyle}
          />
        </label>

        <label style={fieldLabelStyle}>
          Tipo
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "" | EmployeeKind)}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {employeeKinds.map((employeeKind) => (
              <option key={employeeKind} value={employeeKind}>
                {employeeKindLabel[employeeKind]}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabelStyle}>
          Activo
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as "" | "true" | "false")}
            style={inputStyle}
          >
            <option value="">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={() => void load()} style={darkBtn}>
          Aplicar
        </button>
      </div>
    </div>
  );
}

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};
