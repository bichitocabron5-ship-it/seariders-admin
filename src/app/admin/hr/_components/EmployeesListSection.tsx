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

type EmployeeRow = {
  id: string;
  code: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  kind: EmployeeKind;
  jobTitle: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    isActive: boolean;
    passportCode: string | null;
  } | null;
};

const EMPLOYEE_KIND_LABEL: Record<EmployeeKind, string> = {
  MONITOR: "Monitor",
  SKIPPER: "Patrón",
  SELLER: "Vendedor",
  INTERN: "Prácticas",
  MECHANIC: "Mecánico",
  HR: "RRHH",
  SECURITY: "Seguridad",
  ASSISTANT_MECHANIC: "Ayudante mecánico",
  EXTRA: "Extra",
  MANAGER: "Responsable",
};

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const shellStyle: CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
};

const itemStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
};

const actionBtnStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
};

export default function EmployeesListSection({
  rows,
  loading,
  error,
  onEdit,
  onToggleActive,
}: {
  rows: EmployeeRow[];
  loading: boolean;
  error: string | null;
  onEdit: (row: EmployeeRow) => void;
  onToggleActive: (row: EmployeeRow) => void | Promise<void>;
}) {
  return (
    <div style={shellStyle}>
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 950 }}>Trabajadores</div>
        <div style={{ fontWeight: 900, opacity: 0.8 }}>{rows.length}</div>
      </div>

      <div style={{ padding: 12 }}>
        {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              fontWeight: 900,
            }}
          >
            {error}
          </div>
        ) : null}

        {!loading && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay trabajadores.</div> : null}

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} style={itemStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{row.fullName}</div>

                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      fontWeight: 900,
                      fontSize: 12,
                      background: row.isActive ? "#ecfeff" : "#fafafa",
                    }}
                  >
                    {row.isActive ? "ACTIVO" : "INACTIVO"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {EMPLOYEE_KIND_LABEL[row.kind]}
                    {row.jobTitle ? ` · ${row.jobTitle}` : ""}
                    {row.code ? ` · ${row.code}` : ""}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Actualizado: <b>{fmtDateTime(row.updatedAt)}</b>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                {row.email ? row.email : "Sin email"}
                {row.phone ? ` · ${row.phone}` : ""}
                {row.note ? ` · ${row.note}` : ""}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                Usuario:{" "}
                <b>
                  {row.user
                    ? `${row.user.username}${row.user.passportCode ? ` · ${row.user.passportCode}` : ""}`
                    : "No vinculado"}
                </b>
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onEdit(row)} style={actionBtnStyle}>
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => onToggleActive(row)}
                  style={{
                    ...actionBtnStyle,
                    background: row.isActive ? "#fff" : "#111",
                    color: row.isActive ? "#111" : "#fff",
                  }}
                >
                  {row.isActive ? "Dar de baja" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
