"use client";

import type React from "react";

import type { UserRow } from "../types";

export default function AdminUsersListSection({
  rows,
  loading,
  error,
  cardStyle,
  ghostBtn,
  darkBtn,
  errorBox,
  fmtDateTime,
  roleLabel,
  onEdit,
  onToggleActive,
}: {
  rows: UserRow[];
  loading: boolean;
  error: string | null;
  cardStyle: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  darkBtn: React.CSSProperties;
  errorBox: React.CSSProperties;
  fmtDateTime: (iso: string) => string;
  roleLabel: (name: UserRow["roles"][number]["role"]["name"]) => string;
  onEdit: (row: UserRow) => void;
  onToggleActive: (row: UserRow) => void;
}) {
  return (
    <section style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 20 }}>Listado</div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{rows.length} registro(s)</div>
      </div>

      {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}
      {!loading && !error && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay usuarios.</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <article
            key={row.id}
            style={{
              border: "1px solid #e5edf4",
              borderRadius: 18,
              padding: 14,
              background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)",
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{row.username}</div>
                  <span style={row.isActive ? okBadge : mutedBadge}>{row.isActive ? "Activo" : "Inactivo"}</span>
                  {row.passportCode ? <span style={mutedBadge}>{row.passportCode}</span> : null}
                </div>
                <div style={{ fontSize: 14, color: "#334155" }}>
                  <b>{row.fullName}</b>
                  {row.email ? ` · ${row.email}` : ""}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {row.employee
                    ? `Empleado: ${row.employee.fullName}${row.employee.code ? ` (${row.employee.code})` : ""} · ${row.employee.kind}`
                    : "Sin empleado vinculado"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Actualizado: <b>{fmtDateTime(row.updatedAt)}</b>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => onEdit(row)} style={ghostBtn}>
                    Editar
                  </button>
                  <button type="button" onClick={() => onToggleActive(row)} style={row.isActive ? ghostBtn : darkBtn}>
                    {row.isActive ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {row.roles.length === 0 ? <span style={mutedBadge}>Sin roles</span> : null}
              {row.roles.map((role) => (
                <span key={role.roleId} style={roleBadge}>
                  {roleLabel(role.role.name)}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const roleBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 900,
  fontSize: 12,
};

const mutedBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 900,
  fontSize: 12,
};

const okBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 900,
  fontSize: 12,
};
