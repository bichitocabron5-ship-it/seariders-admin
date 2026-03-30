"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import UserModal from "@/app/admin/users/_components/UserModal";

type RoleName = "ADMIN" | "STORE" | "PLATFORM" | "BOOTH" | "BAR" | "MECHANIC" | "HR";
type EmployeeLite = { id: string; code: string | null; fullName: string; kind: string; isActive: boolean };
type UserRow = {
  id: string;
  employeeId: string | null;
  fullName: string;
  username: string;
  email: string | null;
  passportCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  employee?: EmployeeLite | null;
  roles: Array<{ userId: string; roleId: string; role: { id: string; name: RoleName } }>;
};

const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  STORE: "Tienda",
  PLATFORM: "Plataforma",
  BOOTH: "Carpa",
  BAR: "Bar",
  MECHANIC: "Mecánica",
  HR: "RR. HH.",
};

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1360px, 100%)",
  display: "grid",
  gap: 16,
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 22,
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  width: "100%",
  padding: 10,
  borderRadius: 12,
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  fontWeight: 900,
  color: "#111",
  textDecoration: "none",
};

const darkBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (active) p.set("active", active);
    return p.toString();
  }, [q, active]);

  const load = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      const showLoading = opts?.showLoading ?? true;
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const [usersRes, employeesRes] = await Promise.all([
          fetch(`/api/admin/users?${params}`, { cache: "no-store" }),
          fetch("/api/admin/hr?active=true", { cache: "no-store" }),
        ]);

        if (!usersRes.ok) throw new Error(await usersRes.text());
        if (!employeesRes.ok) throw new Error(await employeesRes.text());

        const usersJson = await usersRes.json();
        const employeesJson = await employeesRes.json();

        setRows(usersJson.rows ?? []);
        setEmployees(
          (employeesJson.rows ?? []).map((employee: EmployeeLite) => ({
            id: employee.id,
            code: employee.code,
            fullName: employee.fullName,
            kind: employee.kind,
            isActive: employee.isActive,
          }))
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error cargando usuarios");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [params]
  );

  useEffect(() => {
    void load({ showLoading: true });
  }, [load]);

  async function toggleActive(row: UserRow) {
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load({ showLoading: false });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error actualizando estado");
    }
  }

  const activeCount = rows.filter((row) => row.isActive).length;
  const linkedCount = rows.filter((row) => !!row.employee).length;
  const adminCount = rows.filter((row) => row.roles.some((role) => role.role.name === "ADMIN")).length;
  const platformCount = rows.filter((row) => row.roles.some((role) => role.role.name === "PLATFORM")).length;

  return (
    <div style={pageShell}>
      <section
        style={{
          ...softCard,
          padding: 20,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}
        >
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                color: "#4f46e5",
              }}
            >
              Admin
            </div>
            <div
              style={{
                ...opsStyles.heroTitle,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.02,
                color: "#0f172a",
              }}
            >
              Usuarios y accesos
            </div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Credenciales, roles y vinculación con empleado en una vista más limpia y operativa.
            </div>
          </div>

          <div style={opsStyles.actionGrid}>
            <Link href="/admin" style={ghostBtn}>
              Volver a Admin
            </Link>
            <button type="button" onClick={() => void load({ showLoading: true })} style={ghostBtn}>
              Refrescar
            </button>
            <button type="button" onClick={() => setOpenCreate(true)} style={darkBtn}>
              Nuevo usuario
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={pillStyle}>Usuarios: {rows.length}</span>
          <span style={pillStyle}>Activos: {activeCount}</span>
          <span style={pillStyle}>Con empleado: {linkedCount}</span>
          <span style={pillStyle}>Admins: {adminCount}</span>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <SummaryCard title="Usuarios" value={rows.length} tone="neutral" />
        <SummaryCard title="Activos" value={activeCount} tone="success" />
        <SummaryCard title="Con empleado" value={linkedCount} tone="info" />
        <SummaryCard title="Plataforma" value={platformCount} tone="warning" />
      </div>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Filtros</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Buscar
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, username, email o código"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Estado
            <select value={active} onChange={(e) => setActive(e.target.value as "" | "true" | "false")} style={inputStyle}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
        </div>
      </section>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
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
                    <button type="button" onClick={() => setEditing(row)} style={ghostBtn}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(row)}
                      style={row.isActive ? ghostBtn : darkBtn}
                    >
                      {row.isActive ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {row.roles.length === 0 ? <span style={mutedBadge}>Sin roles</span> : null}
                {row.roles.map((role) => (
                  <span key={role.roleId} style={roleBadge}>
                    {ROLE_LABEL[role.role.name]}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {openCreate ? (
        <UserModal
          title="Nuevo usuario"
          employees={employees}
          existingUsers={rows}
          inputStyle={inputStyle}
          ghostBtn={ghostBtn}
          darkBtn={darkBtn}
          errorBox={errorBox}
          overlayStyle={overlayStyle}
          modalStyle={modalStyle}
          onClose={() => setOpenCreate(false)}
          onSaved={async () => {
            setOpenCreate(false);
            await load({ showLoading: true });
          }}
        />
      ) : null}

      {editing ? (
        <UserModal
          title="Editar usuario"
          initial={editing}
          employees={employees}
          existingUsers={rows}
          inputStyle={inputStyle}
          ghostBtn={ghostBtn}
          darkBtn={darkBtn}
          errorBox={errorBox}
          overlayStyle={overlayStyle}
          modalStyle={modalStyle}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load({ showLoading: true });
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "neutral" | "success" | "info" | "warning";
}) {
  const toneStyles: Record<string, React.CSSProperties> = {
    neutral: { border: "1px solid #dbe4ea", background: "#fff", color: "#0f172a" },
    success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" },
    info: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" },
    warning: { border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" },
  };

  return (
    <div style={{ ...opsStyles.metricCard, ...toneStyles[tone], padding: 14, boxShadow: "none" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #c7d2fe",
  background: "rgba(255,255,255,0.86)",
  color: "#312e81",
  fontWeight: 900,
  fontSize: 12,
};

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

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.38)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 70,
};

const modalStyle: React.CSSProperties = {
  width: "min(980px, 100%)",
  borderRadius: 20,
  border: "1px solid #dbe4ea",
  background: "#fff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
  padding: 18,
  display: "grid",
  gap: 14,
};
