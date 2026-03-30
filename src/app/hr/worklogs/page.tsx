// src/app/hr/worklogs/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import WorklogsFiltersSection from "@/app/hr/worklogs/_components/WorklogsFiltersSection";
import WorklogsListSection from "@/app/hr/worklogs/_components/WorklogsListSection";
import WorklogModal from "@/app/hr/worklogs/_components/WorklogModal";

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
  employee: EmployeeLite;
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
};

const AREAS: WorkArea[] = ["PLATFORM", "BOOTH", "STORE", "BAR", "MECHANICS", "HR", "ADMIN", "OTHER"];
const STATUSES: WorkLogStatus[] = ["OPEN", "CLOSED", "APPROVED", "CANCELED"];

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1360px, 100%)",
  gap: 16,
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

const errorBox: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const todayStr = new Date().toISOString().slice(0, 10);

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMinutes(total: number | null) {
  if (total === null || total === undefined) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

function areaLabel(area: WorkArea) {
  switch (area) {
    case "PLATFORM":
      return "Plataforma";
    case "BOOTH":
      return "Booth";
    case "STORE":
      return "Tienda";
    case "BAR":
      return "Bar";
    case "MECHANICS":
      return "Mecánica";
    case "HR":
      return "RR. HH.";
    case "ADMIN":
      return "Admin";
    default:
      return "Otra";
  }
}

function employeeKindLabel(kind: string) {
  switch (kind) {
    case "MONITOR":
      return "Monitor";
    case "SKIPPER":
      return "Patrón";
    case "SELLER":
      return "Vendedor";
    case "INTERN":
      return "Prácticas";
    case "MECHANIC":
      return "Mecánico";
    case "HR":
      return "RR. HH.";
    case "SECURITY":
      return "Seguridad";
    case "ASSISTANT_MECHANIC":
      return "Ayudante mecánico";
    case "EXTRA":
      return "Extra";
    case "MANAGER":
      return "Responsable";
    default:
      return kind;
  }
}

function statusLabel(status: WorkLogStatus) {
  switch (status) {
    case "OPEN":
      return "Abierto";
    case "APPROVED":
      return "Aprobado";
    case "CLOSED":
      return "Cerrado";
    case "CANCELED":
      return "Cancelado";
    default:
      return status;
  }
}

export default function HrWorklogsPage() {
  const [rows, setRows] = useState<WorkLogRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [area, setArea] = useState<"" | WorkArea>("");
  const [status, setStatus] = useState<"" | WorkLogStatus>("");
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLogRow | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (employeeId) p.set("employeeId", employeeId);
    if (area) p.set("area", area);
    if (status) p.set("status", status);
    if (from) p.set("from", new Date(`${from}T00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59`).toISOString());
    p.set("take", "200");
    return p.toString();
  }, [employeeId, area, status, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, empRes] = await Promise.all([
        fetch(`/api/hr/worklogs?${query}`, { cache: "no-store" }),
        fetch(`/api/hr/employees?isActive=true`, { cache: "no-store" }),
      ]);

      if (!logsRes.ok) throw new Error(await logsRes.text());
      if (!empRes.ok) throw new Error(await empRes.text());

      const logsJson = await logsRes.json();
      const empJson = await empRes.json();

      setRows(logsJson.rows ?? []);
      setEmployees(empJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando worklogs");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function quickAction(
    id: string,
    action: "check_in_now" | "check_out_now" | "approve" | "cancel" | "reopen"
  ) {
    try {
      setError(null);

      const res = await fetch(`/api/hr/worklogs/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error(await res.text());

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en acción rápida");
    }
  }

  async function bulkApprove(action: "approve_day_closed" | "approve_week_closed") {
    try {
      setError(null);

      const targetDate = from || new Date().toISOString().slice(0, 10);

      const res = await fetch("/api/hr/worklogs/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          date: targetDate,
          employeeId: employeeId || null,
          area: area || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en aprobación masiva");
    }
  }

  const openCount = rows.filter((r) => r.status === "OPEN").length;
  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;
  const closedCount = rows.filter((r) => r.status === "CLOSED").length;
  const workedMinutesTotal = rows.reduce((acc, r) => acc + Number(r.workedMinutes ?? 0), 0);
  const internCount = rows.filter((r) => r.employee.kind === "INTERNAL").length;

  return (
    <div style={pageShell}>
      <div style={{ ...softCard, padding: "clamp(18px, 3vw, 24px)", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: "clamp(30px, 4vw, 38px)", lineHeight: 1 }}>Fichajes</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>Entrada, salida, descansos y horas trabajadas</div>
        </div>

        <div style={opsStyles.actionGrid}>
          <Link href="/hr" style={ghostBtn}>RR. HH.</Link>
          <button type="button" onClick={() => load()} style={ghostBtn}>Refrescar</button>
          <button type="button" onClick={() => { setEditing(null); setOpen(true); }} style={primaryBtn}>Nuevo fichaje</button>
          <Link href="/hr/worklogs/week" style={ghostBtn}>Vista semanal</Link>
        </div>
      </div>

      <WorklogsFiltersSection
        employees={employees}
        employeeId={employeeId}
        area={area}
        status={status}
        from={from}
        to={to}
        areas={AREAS}
        statuses={STATUSES}
        onEmployeeChange={setEmployeeId}
        onAreaChange={setArea}
        onStatusChange={setStatus}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => load()}
        onApproveDay={() => bulkApprove("approve_day_closed")}
        onApproveWeek={() => bulkApprove("approve_week_closed")}
        areaLabel={areaLabel}
        statusLabel={statusLabel}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MiniKpi title="Abiertas" value={openCount} warn={openCount > 0} />
        <MiniKpi title="Cerradas" value={closedCount} />
        <MiniKpi title="Aprobadas" value={approvedCount} />
        <MiniKpi title="Horas" value={fmtMinutes(workedMinutesTotal)} />
        <MiniKpi title="Prácticas" value={internCount} />
      </div>

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      <WorklogsListSection
        rows={rows}
        loading={loading}
        error={error}
        onOpen={(row) => {
          setEditing(row);
          setOpen(true);
        }}
        onQuickAction={quickAction}
        employeeKindLabel={employeeKindLabel}
        statusLabel={statusLabel}
        areaLabel={areaLabel}
        fmtDateInput={fmtDateInput}
        fmtDateTime={fmtDateTime}
        fmtMinutes={fmtMinutes}
      />

      {open ? (
        <WorklogModal
          initial={editing}
          employees={employees}
          areas={AREAS}
          statuses={STATUSES}
          ghostBtn={ghostBtn}
          primaryBtn={primaryBtn}
          inputStyle={inputStyle}
          errorBox={errorBox}
          areaLabel={areaLabel}
          statusLabel={statusLabel}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function MiniKpi({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return <div style={{ ...softCard, border: warn ? "1px solid #fde68a" : "1px solid #dbe4ea", background: warn ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff", padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div><div style={{ marginTop: 4, fontSize: 24, fontWeight: 950, color: warn ? "#92400e" : "#111" }}>{value}</div></div>;
}
