"use client";

import type React from "react";

import type { EmployeeLite, EmployeeRateType } from "../types";

export function HrRatesFiltersSection({
  employeeId,
  rateType,
  billableEmployees,
  rateTypes,
  rateTypeLabel,
  onEmployeeChange,
  onRateTypeChange,
  onApply,
  inputStyle,
  primaryBtn,
}: {
  employeeId: string;
  rateType: "" | EmployeeRateType;
  billableEmployees: EmployeeLite[];
  rateTypes: EmployeeRateType[];
  rateTypeLabel: (type: EmployeeRateType) => string;
  onEmployeeChange: (value: string) => void;
  onRateTypeChange: (value: "" | EmployeeRateType) => void;
  onApply: () => void;
  inputStyle: React.CSSProperties;
  primaryBtn: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "2fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >
      <Field label="Trabajador">
        <select value={employeeId} onChange={(e) => onEmployeeChange(e.target.value)} style={inputStyle}>
          <option value="">Todos</option>
          {billableEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tipo tarifa">
        <select value={rateType} onChange={(e) => onRateTypeChange(e.target.value as "" | EmployeeRateType)} style={inputStyle}>
          <option value="">Todas</option>
          {rateTypes.map((type) => (
            <option key={type} value={type}>
              {rateTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>

      <button type="button" onClick={onApply} style={primaryBtn}>
        Aplicar
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}
