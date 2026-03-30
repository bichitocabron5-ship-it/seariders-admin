"use client";

import { useMemo, useState } from "react";

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
  MECHANIC: "Mecánica",
  HR: "RR. HH.",
};

type Props = {
  title: string;
  initial?: UserRow | null;
  employees: EmployeeLite[];
  existingUsers: UserRow[];
  inputStyle: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  darkBtn: React.CSSProperties;
  errorBox: React.CSSProperties;
  overlayStyle: React.CSSProperties;
  modalStyle: React.CSSProperties;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function UserModal({
  title,
  initial,
  employees,
  existingUsers,
  inputStyle,
  ghostBtn,
  darkBtn,
  errorBox,
  overlayStyle,
  modalStyle,
  onClose,
  onSaved,
}: Props) {
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [passportCode, setPassportCode] = useState(initial?.passportCode ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [roles, setRoles] = useState<RoleName[]>(initial?.roles.map((role) => role.role.name) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableEmployees = useMemo(
    () =>
      !initial
        ? employees.filter((employee) => !existingUsers.some((user) => user.employeeId === employee.id))
        : employees.filter(
            (employee) =>
              employee.id === initial.employeeId ||
              !existingUsers.some((user) => user.employeeId === employee.id && user.id !== initial.id)
          ),
    [employees, existingUsers, initial]
  );

  function toggleRole(role: RoleName) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((value) => value !== role) : [...prev, role]));
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
                const employee = availableEmployees.find((value) => value.id === id);
                if (employee && !initial) setFullName((prev) => prev || employee.fullName);
              }}
              style={inputStyle}
            >
              <option value="">Sin vincular</option>
              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.code ? ` · ${employee.code}` : ""}
                  {` · ${employee.kind}`}
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
              placeholder={initial ? "Dejar vacío para mantenerla" : "Temporal"}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Código interno
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
            {ROLE_NAMES.map((role) => (
              <label
                key={role}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  border: "1px solid #dbe4ea",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: roles.includes(role) ? "#f8fafc" : "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                {ROLE_LABEL[role]}
              </label>
            ))}
          </div>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            style={{ ...darkBtn, background: busy ? "#9ca3af" : "#111" }}
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
