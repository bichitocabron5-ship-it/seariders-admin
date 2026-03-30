"use client";

import Link from "next/link";
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
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
};

type WorkLogRow = {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  breakMinutes: number;
  workedMinutes: number | null;
  area: WorkArea;
  status: WorkLogStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  approvedByUserId: string | null;
  approvedByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
  employee: EmployeeLite;
};

type Props = {
  rows: WorkLogRow[];
  loading: boolean;
  error: string | null;
  onOpen: (row: WorkLogRow) => void;
  onQuickAction: (
    rowId: string,
    action: "check_in_now" | "check_out_now" | "approve" | "reopen" | "cancel"
  ) => Promise<void>;
  employeeKindLabel: (kind: string) => string;
  statusLabel: (status: WorkLogStatus) => string;
  areaLabel: (area: WorkArea) => string;
  fmtDateInput: (iso: string | null) => string;
  fmtDateTime: (iso: string | null) => string;
  fmtMinutes: (total: number | null) => string;
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

function statusStyle(status: WorkLogStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
  };
  if (status === "APPROVED") return { ...base, background: "#ecfdf5", borderColor: "#bbf7d0", color: "#166534" };
  if (status === "CLOSED") return { ...base, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" };
  if (status === "CANCELED") return { ...base, background: "#fff1f2", borderColor: "#fecaca", color: "#b91c1c" };
  return { ...base, background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" };
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function QuickActionButton({
  label,
  onClick,
  primary,
  danger,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: primary ? "1px solid #111" : danger ? "1px solid #fecaca" : "1px solid #e5e7eb",
        background: primary ? "#111" : danger ? "#fff1f2" : "#fff",
        color: primary ? "#fff" : danger ? "#991b1b" : "#111",
        fontWeight: 900,
      }}
    >
      {label}
    </button>
  );
}

export default function WorklogsListSection({
  rows,
  loading,
  error,
  onOpen,
  onQuickAction,
  employeeKindLabel,
  statusLabel,
  areaLabel,
  fmtDateInput,
  fmtDateTime,
  fmtMinutes,
}: Props) {
  if (!loading && !error && rows.length === 0) {
    return <div style={{ ...softCard, padding: 18 }}>No hay fichajes para los filtros seleccionados.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onOpen(row)}
          style={{
            ...softCard,
            textAlign: "left",
            padding: 14,
            cursor: "pointer",
            background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <Link
                href={`/hr/employees/${row.employee.id}`}
                style={{ textDecoration: "none", color: "#111", fontWeight: 950, fontSize: 18 }}
                onClick={(e) => e.stopPropagation()}
              >
                {row.employee.fullName}
              </Link>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {employeeKindLabel(row.employee.kind)}
                {row.employee.jobTitle ? ` · ${row.employee.jobTitle}` : ""}
                {row.employee.code ? ` · ${row.employee.code}` : ""}
              </div>
            </div>

            <div style={statusStyle(row.status)}>{statusLabel(row.status)}</div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!row.checkInAt ? (
              <QuickActionButton
                label="Entrada ahora"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onQuickAction(row.id, "check_in_now");
                }}
              />
            ) : null}
            {row.checkInAt && !row.checkOutAt && row.status !== "CANCELED" ? (
              <QuickActionButton
                label="Salida ahora"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onQuickAction(row.id, "check_out_now");
                }}
              />
            ) : null}
            {row.status === "CLOSED" ? (
              <QuickActionButton
                label="Aprobar"
                primary
                onClick={async (e) => {
                  e.stopPropagation();
                  await onQuickAction(row.id, "approve");
                }}
              />
            ) : null}
            {row.status === "APPROVED" || row.status === "CLOSED" ? (
              <QuickActionButton
                label="Reabrir"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onQuickAction(row.id, "reopen");
                }}
              />
            ) : null}
            {row.status !== "CANCELED" ? (
              <QuickActionButton
                label="Cancelar"
                danger
                onClick={async (e) => {
                  e.stopPropagation();
                  await onQuickAction(row.id, "cancel");
                }}
              />
            ) : null}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            <Mini label="Fecha" value={fmtDateInput(row.workDate)} />
            <Mini label="Entrada" value={fmtDateTime(row.checkInAt)} />
            <Mini label="Salida" value={fmtDateTime(row.checkOutAt)} />
            <Mini label="Descanso" value={`${row.breakMinutes} min`} />
            <Mini label="Trabajado" value={fmtMinutes(row.workedMinutes)} />
            <Mini label="Área" value={areaLabel(row.area)} />
          </div>

          {row.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Nota: {row.note}</div> : null}
        </button>
      ))}
    </div>
  );
}
