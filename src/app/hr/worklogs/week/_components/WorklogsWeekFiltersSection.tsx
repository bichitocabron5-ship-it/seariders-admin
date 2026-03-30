"use client";

import { opsStyles } from "@/components/ops-ui";

type WorkArea =
  | "PLATFORM"
  | "BOOTH"
  | "STORE"
  | "BAR"
  | "MECHANICS"
  | "HR"
  | "ADMIN"
  | "OTHER";

type EmployeeLite = {
  id: string;
  fullName: string;
};

type Props = {
  weekStart: string;
  employeeId: string;
  area: "" | WorkArea;
  employees: EmployeeLite[];
  areas: WorkArea[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onWeekStartChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onAreaChange: (value: "" | WorkArea) => void;
  onApply: () => void;
  areaLabel: (area: WorkArea) => string;
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 12,
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  color: "#111",
};

const primaryBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  fontWeight: 950,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13 }}>{label}{children}</label>;
}

export default function WorklogsWeekFiltersSection({
  weekStart,
  employeeId,
  area,
  employees,
  areas,
  onPrevWeek,
  onNextWeek,
  onWeekStartChange,
  onEmployeeChange,
  onAreaChange,
  onApply,
  areaLabel,
}: Props) {
  return (
    <div
      style={{
        ...softCard,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        alignItems: "end",
      }}
    >
      <button type="button" onClick={onPrevWeek} style={ghostBtn}>Semana anterior</button>
      <button type="button" onClick={onNextWeek} style={ghostBtn}>Semana siguiente</button>

      <Field label="Semana (lunes)">
        <input type="date" value={weekStart} onChange={(e) => onWeekStartChange(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Trabajador">
        <select value={employeeId} onChange={(e) => onEmployeeChange(e.target.value)} style={inputStyle}>
          <option value="">Todos</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
          ))}
        </select>
      </Field>

      <Field label="Área">
        <select value={area} onChange={(e) => onAreaChange(e.target.value as "" | WorkArea)} style={inputStyle}>
          <option value="">Todas</option>
          {areas.map((item) => (
            <option key={item} value={item}>{areaLabel(item)}</option>
          ))}
        </select>
      </Field>

      <button type="button" onClick={onApply} style={primaryBtn}>Aplicar</button>
    </div>
  );
}
