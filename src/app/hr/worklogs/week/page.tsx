// src/app/hr/worklogs/week/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import WorklogsWeekFiltersSection from "@/app/hr/worklogs/week/_components/WorklogsWeekFiltersSection";
import WorklogsWeekTableSection from "@/app/hr/worklogs/week/_components/WorklogsWeekTableSection";

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

type WeekResponse = {
  ok: true;
  week: {
    start: string;
    end: string;
    days: Array<{
      index: number;
      date: string;
      ymd: string;
    }>;
  };
  filters: {
    employeeId: string | null;
    area: WorkArea | null;
    status: WorkLogStatus | null;
  };
  employees: Array<{
    employee: {
      id: string;
      code: string | null;
      fullName: string;
      kind: string;
      jobTitle: string | null;
      isActive: boolean;
    };
    totalMinutes: number;
    totalLogs: number;
    perDay: Array<{
      ymd: string;
      date: string;
      workedMinutes: number;
      logs: number;
      openLogs: number;
      approvedLogs: number;
      statuses: string[];
      areas: string[];
    }>;
  }>;
  totals: {
    weekMinutes: number;
    weekLogs: number;
    byDay: Array<{
      ymd: string;
      date: string;
      totalMinutes: number;
      totalLogs: number;
      openLogs: number;
      approvedLogs: number;
    }>;
  };
};

type EmployeeLite = {
  id: string;
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
};

const AREAS: WorkArea[] = ["PLATFORM", "BOOTH", "STORE", "BAR", "MECHANICS", "HR", "ADMIN", "OTHER"];

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

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

function fmtMinutes(total: number | null) {
  if (total === null || total === undefined) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

function fmtDayShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function mondayOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
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

export default function HrWorklogsWeekPage() {
  const [data, setData] = useState<WeekResponse | null>(null);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState(() => dateInput(mondayOfWeek(new Date())));
  const [employeeId, setEmployeeId] = useState("");
  const [area, setArea] = useState<"" | WorkArea>("");
  const status: "" | WorkLogStatus = "";

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("weekStart", weekStart);
    if (employeeId) p.set("employeeId", employeeId);
    if (area) p.set("area", area);
    if (status) p.set("status", status);
    return p.toString();
  }, [weekStart, employeeId, area, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [weekRes, empRes] = await Promise.all([
        fetch(`/api/hr/worklogs/week?${query}`, { cache: "no-store" }),
        fetch(`/api/hr/employees?isActive=true`, { cache: "no-store" }),
      ]);

      if (!weekRes.ok) throw new Error(await weekRes.text());
      if (!empRes.ok) throw new Error(await empRes.text());

      const weekJson = (await weekRes.json()) as WeekResponse;
      const empJson = await empRes.json();

      setData(weekJson);
      setEmployees(empJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando semana");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const prevWeek = () => {
    const d = new Date(`${weekStart}T00:00:00`);
    setWeekStart(dateInput(addDays(d, -7)));
  };

  const nextWeek = () => {
    const d = new Date(`${weekStart}T00:00:00`);
    setWeekStart(dateInput(addDays(d, 7)));
  };

  const openLogsCount = data?.employees.reduce((acc, e) => acc + e.perDay.reduce((sum, d) => sum + d.openLogs, 0), 0) ?? 0;

  return (
    <div style={pageShell}>
      <div style={{ ...softCard, padding: "clamp(18px, 3vw, 24px)", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: "clamp(30px, 4vw, 38px)", lineHeight: 1 }}>Horas semanales</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>Vista semanal por trabajador y totales diarios</div>
        </div>

        <div style={opsStyles.actionGrid}>
          <Link href="/hr/worklogs" style={ghostBtn}>Fichajes</Link>
          <button type="button" onClick={load} style={ghostBtn}>Refrescar</button>
        </div>
      </div>

      <WorklogsWeekFiltersSection
        weekStart={weekStart}
        employeeId={employeeId}
        area={area}
        employees={employees}
        areas={AREAS}
        onPrevWeek={prevWeek}
        onNextWeek={nextWeek}
        onWeekStartChange={setWeekStart}
        onEmployeeChange={setEmployeeId}
        onAreaChange={setArea}
        onApply={load}
        areaLabel={areaLabel}
      />

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <MiniKpi title="Total semana" value={fmtMinutes(data.totals.weekMinutes)} />
            <MiniKpi title="Registros" value={data.totals.weekLogs} />
            <MiniKpi title="Trabajadores" value={data.employees.length} />
            <MiniKpi title="Abiertas" value={openLogsCount} warn />
          </div>

          <WorklogsWeekTableSection
            employees={data.employees}
            weekDays={data.week.days}
            totalsByDay={data.totals.byDay}
            weekMinutes={data.totals.weekMinutes}
            weekLogs={data.totals.weekLogs}
            fmtMinutes={fmtMinutes}
            fmtDayShort={fmtDayShort}
            employeeKindLabel={employeeKindLabel}
          />
        </>
      ) : null}
    </div>
  );
}

function MiniKpi({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return <div style={{ ...softCard, border: warn ? "1px solid #fde68a" : "1px solid #dbe4ea", background: warn ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff", padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div><div style={{ marginTop: 4, fontSize: 24, fontWeight: 950, color: warn ? "#92400e" : "#111" }}>{value}</div></div>;
}
