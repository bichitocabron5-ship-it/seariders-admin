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

type WorkLogStatus = "OPEN" | "CLOSED" | "APPROVED" | "CANCELED";

type EmployeeLite = {
  id: string;
  fullName: string;
};

type Props = {
  employees: EmployeeLite[];
  employeeId: string;
  area: "" | WorkArea;
  status: "" | WorkLogStatus;
  from: string;
  to: string;
  areas: WorkArea[];
  statuses: WorkLogStatus[];
  onEmployeeChange: (value: string) => void;
  onAreaChange: (value: "" | WorkArea) => void;
  onStatusChange: (value: "" | WorkLogStatus) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  onApproveDay: () => void;
  onApproveWeek: () => void;
  areaLabel: (area: WorkArea) => string;
  statusLabel: (status: WorkLogStatus) => string;
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  color: "#111",
};

const primaryBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  fontWeight: 950,
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 12,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13 }}>{label}{children}</label>;
}

export default function WorklogsFiltersSection({
  employees,
  employeeId,
  area,
  status,
  from,
  to,
  areas,
  statuses,
  onEmployeeChange,
  onAreaChange,
  onStatusChange,
  onFromChange,
  onToChange,
  onApply,
  onApproveDay,
  onApproveWeek,
  areaLabel,
  statusLabel,
}: Props) {
  return (
    <>
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
        <Field label="Trabajador">
          <select value={employeeId} onChange={(e) => onEmployeeChange(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Área">
          <select value={area} onChange={(e) => onAreaChange(e.target.value as "" | WorkArea)} style={inputStyle}>
            <option value="">Todas</option>
            {areas.map((item) => (
              <option key={item} value={item}>
                {areaLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estado">
          <select value={status} onChange={(e) => onStatusChange(e.target.value as "" | WorkLogStatus)} style={inputStyle}>
            <option value="">Todos</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} style={inputStyle} />
        </Field>

        <button type="button" onClick={onApply} style={primaryBtn}>
          Aplicar
        </button>
      </div>

      <div style={opsStyles.actionGrid}>
        <button type="button" onClick={onApproveDay} style={ghostBtn}>
          Aprobar jornadas cerradas del día
        </button>
        <button type="button" onClick={onApproveWeek} style={ghostBtn}>
          Aprobar jornadas cerradas de la semana
        </button>
      </div>
    </>
  );
}
