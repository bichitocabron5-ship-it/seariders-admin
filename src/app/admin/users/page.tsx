"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
type UserUpsertBody = {
  employeeId: string | null;
  fullName: string;
  username: string;
  email: string | null;
  passportCode: string | null;
  isActive: boolean;
  roles: RoleName[];
  password?: string;
};

const ROLE_NAMES: RoleName[] = ["ADMIN", "STORE", "PLATFORM", "BOOTH", "BAR", "MECHANIC", "HR"];
const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  STORE: "Tienda",
  PLATFORM: "Plataforma",
  BOOTH: "Carpa",
  BAR: "Bar",
  MECHANIC: "Mecanica",
  HR: "RRHH",
};

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const pageShell: React.CSSProperties = {
  maxWidth: 1360,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 16,
};

const softCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
  fontWeight: 900,
  color: "#111",
  textDecoration: "none",
};

const darkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
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

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [uRes, eRes] = await Promise.all([
        fetch(`/api/admin/users?${params}`, { cache: "no-store" }),
        fetch("/api/admin/hr?active=true", { cache: "no-store" }),
      ]);
      if (!uRes.ok) throw new Error(await uRes.text());
      if (!eRes.ok) throw new Error(await eRes.text());
      const uJson = await uRes.json();
      const eJson = await eRes.json();
      setRows(uJson.rows ?? []);
      setEmployees(
        (eJson.rows ?? []).map((e: EmployeeLite) => ({
          id: e.id,
          code: e.code,
          fullName: e.fullName,
          kind: e.kind,
          isActive: e.isActive,
        }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando usuarios");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [params]);

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
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error actualizando estado");
    }
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const linkedCount = rows.filter((r) => !!r.employee).length;
  const adminCount = rows.filter((r) => r.roles.some((x) => x.role.name === "ADMIN")).length;
  const platformCount = rows.filter((r) => r.roles.some((x) => x.role.name === "PLATFORM")).length;

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#4f46e5" }}>
              Admin
            </div>
            <div style={{ fontSize: 34, lineHeight: 1.02, fontWeight: 950, color: "#0f172a" }}>Usuarios y accesos</div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Credenciales, roles y vinculacion con empleado en una vista mas limpia y operativa.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin" style={ghostBtn}>
              Volver a admin
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
        <SummaryCard title="Platform" value={platformCount} tone="warning" />
      </div>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Filtros</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Buscar
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, username, email o codigo"
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Listado</div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{rows.length} registro(s)</div>
        </div>

        {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
        {error ? <div style={errorBox}>{error}</div> : null}
        {!loading && !error && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay usuarios.</div> : null}

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <article
              key={r.id}
              style={{
                border: "1px solid #e5edf4",
                borderRadius: 18,
                padding: 14,
                background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>{r.username}</div>
                    <span style={r.isActive ? okBadge : mutedBadge}>{r.isActive ? "Activo" : "Inactivo"}</span>
                    {r.passportCode ? <span style={mutedBadge}>{r.passportCode}</span> : null}
                  </div>
                  <div style={{ fontSize: 14, color: "#334155" }}>
                    <b>{r.fullName}</b>
                    {r.email ? ` · ${r.email}` : ""}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {r.employee
                      ? `Empleado: ${r.employee.fullName}${r.employee.code ? ` (${r.employee.code})` : ""} · ${r.employee.kind}`
                      : "Sin empleado vinculado"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Actualizado: <b>{fmtDateTime(r.updatedAt)}</b>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setEditing(r)} style={ghostBtn}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(r)}
                      style={r.isActive ? ghostBtn : darkBtn}
                    >
                      {r.isActive ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.roles.length === 0 ? <span style={mutedBadge}>Sin roles</span> : null}
                {r.roles.map((role) => (
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
    <div style={{ ...softCard, ...toneStyles[tone], padding: 14, boxShadow: "none" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function UserModal({
  title,
  initial,
  employees,
  existingUsers,
  onClose,
  onSaved,
}: {
  title: string;
  initial?: UserRow | null;
  employees: EmployeeLite[];
  existingUsers: UserRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [passportCode, setPassportCode] = useState(initial?.passportCode ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [roles, setRoles] = useState<RoleName[]>(initial?.roles.map((r) => r.role.name) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableEmployees = useMemo(
    () =>
      !initial
        ? employees.filter((e) => !existingUsers.some((u) => u.employeeId === e.id))
        : employees.filter(
            (e) => e.id === initial.employeeId || !existingUsers.some((u) => u.employeeId === e.id && u.id !== initial.id)
          ),
    [employees, existingUsers, initial]
  );

  function toggleRole(role: RoleName) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((x) => x !== role) : [...prev, role]));
  }

  async function save() {
    setError(null);
    if (!fullName.trim()) return setError("Nombre obligatorio.");
    if (!username.trim()) return setError("Username obligatorio.");
    if (!initial && !password.trim()) return setError("Password obligatoria.");
    if (roles.length === 0) return setError("Selecciona al menos un rol.");
    setBusy(true);
    try {
      const body: UserUpsertBody = {
        employeeId: employeeId || null,
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim() || null,
        passportCode: passportCode.trim() || null,
        isActive,
        roles,
      };
      if (password.trim()) body.password = password.trim();
      const res = await fetch(initial ? `/api/admin/users/${initial.id}` : "/api/admin/users", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando usuario");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={() => (busy ? null : onClose())}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 24, fontWeight: 950 }}>{title}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Acceso, empleado y roles del usuario.</div>
          </div>
          <button type="button" onClick={() => (busy ? null : onClose())} style={ghostBtn}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Empleado vinculado
            <select
              value={employeeId}
              onChange={(e) => {
                const id = e.target.value;
                setEmployeeId(id);
                const emp = availableEmployees.find((x) => x.id === id);
                if (emp && !initial) setFullName((prev) => prev || emp.fullName);
              }}
              style={inputStyle}
            >
              <option value="">Sin vincular</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.code ? ` · ${e.code}` : ""}
                  {` · ${e.kind}`}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Nombre visible
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            {initial ? "Nueva password" : "Password temporal"}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={initial ? "Dejar vacio para mantenerla" : "Temporal"}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Codigo interno
            <input value={passportCode} onChange={(e) => setPassportCode(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Usuario activo
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Roles</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {ROLE_NAMES.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  border: "1px solid #dbe4ea",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: roles.includes(r) ? "#f8fafc" : "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={() => void save()} disabled={busy} style={{ ...darkBtn, background: busy ? "#9ca3af" : "#111" }}>
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
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
