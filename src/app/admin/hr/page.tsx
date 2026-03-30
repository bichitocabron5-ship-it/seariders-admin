// src/app/admin/hr/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import EmployeesListSection from "./_components/EmployeesListSection";
import EmployeeModal from "./_components/EmployeeModal";
import EmployeesFiltersSection from "./_components/EmployeesFiltersSection";

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
  internshipHoursTotal?: number | null;
  internshipHoursUsed?: number | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
  user?: {
    id: string;
    username: string;
    isActive: boolean;
    passportCode: string | null;
  } | null;
};

const EMPLOYEE_KINDS: EmployeeKind[] = [
  "MONITOR",
  "SKIPPER",
  "SELLER",
  "INTERN",
  "MECHANIC",
  "HR",
  "SECURITY",
  "ASSISTANT_MECHANIC",
  "EXTRA",
  "MANAGER",
];

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

export default function AdminHrPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | EmployeeKind>("");
  const [active, setActive] = useState<"" | "true" | "false">("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (kind) p.set("kind", kind);
    if (active) p.set("active", active);
    return p.toString();
  }, [q, kind, active]);

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/hr?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando RRHH");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  async function toggleActive(row: EmployeeRow) {
    try {
      const res = await fetch(`/api/admin/hr/${row.id}`, {
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

  const stats = useMemo(() => {
    return {
      total: rows.length,
      activeCount: rows.filter((row) => row.isActive).length,
      withUser: rows.filter((row) => Boolean(row.user?.id)).length,
    };
  }, [rows]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Personal</div>
          <div style={titleStyle}>RRHH</div>
          <div style={subtitleStyle}>
            Trabajadores, perfiles operativos y vínculo con usuarios
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button
            type="button"
            onClick={() => load({ showLoading: true })}
            style={ghostButtonElement}
          >
            Refrescar
          </button>

          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            style={darkBtn}
          >
            + Nuevo trabajador
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Trabajadores</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Activos</div>
          <div style={summaryValue}>{stats.activeCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Con usuario</div>
          <div style={summaryValue}>{stats.withUser}</div>
        </article>
      </section>

      <EmployeesFiltersSection
        q={q}
        kind={kind}
        active={active}
        setQ={setQ}
        setKind={setKind}
        setActive={setActive}
        load={() => load({ showLoading: true })}
        employeeKinds={EMPLOYEE_KINDS}
        employeeKindLabel={EMPLOYEE_KIND_LABEL}
        panelStyle={panelStyle}
        darkBtn={darkBtn}
      />

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCard title="Total trabajadores" value={rows.length} />
        <SummaryCard title="Con usuario" value={rows.filter((r) => !!r.user).length} />
        <SummaryCard title="Activos" value={rows.filter((r) => r.isActive).length} />
        <SummaryCard title="Mecánicos" value={rows.filter((r) => r.kind === "MECHANIC").length} />
      </div>

      <EmployeesListSection
        rows={rows}
        loading={loading}
        error={error}
        onEdit={(row) => setEditing(row)}
        onToggleActive={toggleActive}
      />

      {openCreate ? (
        <EmployeeModal
          title="Nuevo trabajador"
          onClose={() => setOpenCreate(false)}
          onSaved={async () => {
            setOpenCreate(false);
            await load({ showLoading: true });
          }}
        />
      ) : null}

      {editing ? (
        <EmployeeModal
          title="Editar trabajador"
          initial={editing}
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

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #f0fdf4 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#15803d",
};

const titleStyle: CSSProperties = {
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
  maxWidth: 760,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  padding: 12,
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const ghostButtonElement: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
};

const darkBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, background: "#fff", padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 22 }}>{value}</div>
    </div>
  );
}

