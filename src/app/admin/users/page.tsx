"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { opsStyles } from "@/components/ops-ui";
import UserModal from "@/app/admin/users/_components/UserModal";
import AdminUsersFiltersSection from "@/app/admin/users/_components/AdminUsersFiltersSection";
import AdminUsersListSection from "@/app/admin/users/_components/AdminUsersListSection";
import { ROLE_LABEL, type EmployeeLite, type UserRow } from "./types";

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
    const searchParams = new URLSearchParams();
    if (q.trim()) searchParams.set("q", q.trim());
    if (active) searchParams.set("active", active);
    return searchParams.toString();
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
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Error cargando usuarios");
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
      const response = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!response.ok) throw new Error(await response.text());
      await load({ showLoading: false });
    } catch (cause: unknown) {
      alert(cause instanceof Error ? cause.message : "Error actualizando estado");
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

      <AdminUsersFiltersSection
        q={q}
        active={active}
        inputStyle={inputStyle}
        cardStyle={softCard}
        onQueryChange={setQ}
        onActiveChange={setActive}
      />

      <AdminUsersListSection
        rows={rows}
        loading={loading}
        error={error}
        cardStyle={softCard}
        ghostBtn={ghostBtn}
        darkBtn={darkBtn}
        errorBox={errorBox}
        fmtDateTime={fmtDateTime}
        roleLabel={(name) => ROLE_LABEL[name]}
        onEdit={setEditing}
        onToggleActive={(row) => {
          void toggleActive(row);
        }}
      />

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
