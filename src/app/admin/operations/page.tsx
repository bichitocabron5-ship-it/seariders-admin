"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type EmployeeOption = {
  id: string;
  fullName: string;
  code: string | null;
  kind: string;
};

type InternalUsageRow = {
  id: string;
  status: string;
  activityDate: string;
  scheduledTime: string | null;
  quantity: number;
  pax: number;
  totalPriceCents: number;
  depositCents: number;
  customerName: string;
  note: string | null;
  readyForPlatformAt: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  createdAt: string;
  assignmentCount: number;
  assignmentMinutes: number | null;
  resources: string[];
  employee: {
    id: string;
    fullName: string;
    code: string | null;
    kind: string;
  } | null;
  service: {
    id: string;
    name: string | null;
    category: string | null;
  } | null;
  option: {
    id: string;
    durationMinutes: number | null;
  } | null;
};

type InternalUsageResponse = {
  ok: true;
  rows: InternalUsageRow[];
  summary: {
    total: number;
    linkedEmployees: number;
    ready: number;
    inSea: number;
    completed: number;
    totalMinutes: number;
  };
};

const EMPTY_SUMMARY: InternalUsageResponse["summary"] = {
  total: 0,
  linkedEmployees: 0,
  ready: 0,
  inSea: 0,
  completed: 0,
  totalMinutes: 0,
};

function dt(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "READY_FOR_PLATFORM") return "Lista para platform";
  if (status === "IN_SEA") return "En mar";
  if (status === "COMPLETED") return "Completada";
  if (status === "WAITING") return "En espera";
  if (status === "CANCELED") return "Cancelada";
  return status;
}

function statusTone(status: string): CSSProperties {
  if (status === "READY_FOR_PLATFORM") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (status === "IN_SEA") return { background: "#ecfeff", color: "#0f766e", border: "1px solid #99f6e4" };
  if (status === "COMPLETED") return { background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" };
  if (status === "CANCELED") return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
  return { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
}

export default function AdminOperationsPage() {
  const [rows, setRows] = useState<InternalUsageRow[]>([]);
  const [summary, setSummary] = useState<InternalUsageResponse["summary"]>(EMPTY_SUMMARY);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (employeeId) p.set("employeeId", employeeId);
    if (status !== "ALL") p.set("status", status);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    p.set("take", "150");
    return p.toString();
  }, [q, employeeId, status, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, employeesRes] = await Promise.all([
        fetch(`/api/admin/operations/internal-usage?${queryString}`, { cache: "no-store" }),
        fetch("/api/admin/hr?active=true", { cache: "no-store" }),
      ]);
      if (!usageRes.ok) throw new Error(await usageRes.text());
      if (!employeesRes.ok) throw new Error(await employeesRes.text());

      const [usageJson, employeesJson] = await Promise.all([usageRes.json(), employeesRes.json()]);
      setRows(usageJson.rows ?? []);
      setSummary(usageJson.summary ?? EMPTY_SUMMARY);
      setEmployees(employeesJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando salidas internas");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Operativa</div>
          <h1 style={titleStyle}>Salidas internas</h1>
          <p style={subtitleStyle}>
            Control operativo de reservas internas de staff vinculadas opcionalmente a trabajador, sin mezclarlo con RR. HH.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>Volver a Admin</Link>
          <Link href="/operations" style={ghostBtn}>Centro operativo</Link>
          <button type="button" onClick={() => void load()} style={darkBtn} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <MetricCard title="Salidas" value={summary.total} />
        <MetricCard title="Con trabajador" value={summary.linkedEmployees} />
        <MetricCard title="Listas" value={summary.ready} />
        <MetricCard title="En mar" value={summary.inSea} />
        <MetricCard title="Completadas" value={summary.completed} />
        <MetricCard title="Minutos trazados" value={summary.totalMinutes} />
      </section>

      <section style={panelStyle}>
        <div style={filtersGrid}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, nota, servicio..." style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Trabajador</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}{employee.code ? ` | ${employee.code}` : ""}{employee.kind ? ` | ${employee.kind}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Estado</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="ALL">Todos</option>
              <option value="READY_FOR_PLATFORM">Lista para platform</option>
              <option value="IN_SEA">En mar</option>
              <option value="COMPLETED">Completada</option>
              <option value="WAITING">En espera</option>
              <option value="CANCELED">Cancelada</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Desde</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Hasta</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>

      <section style={panelStyle}>
        {error ? <div style={errorStyle}>{error}</div> : null}
        {!error && rows.length === 0 ? <div style={{ color: "#64748b" }}>{loading ? "Cargando..." : "No hay salidas internas con esos filtros."}</div> : null}
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <article key={row.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>{row.customerName}</strong>
                    <span style={{ ...pillStyle, ...statusTone(row.status) }}>{statusLabel(row.status)}</span>
                    {row.employee ? (
                      <span style={neutralPill}>{row.employee.fullName}{row.employee.code ? ` | ${row.employee.code}` : ""}</span>
                    ) : (
                      <span style={neutralPill}>Sin trabajador vinculado</span>
                    )}
                  </div>
                  <div style={metaStyle}>
                    {row.service?.name ?? "Servicio"} · {row.option?.durationMinutes ?? "-"} min · {row.quantity} ud · PAX {row.pax}
                  </div>
                  <div style={metaStyle}>
                    Fecha {dt(row.scheduledTime ?? row.activityDate)} · Creada {dt(row.createdAt)}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <a href={`/store?reservationId=${row.id}`} style={linkBtn}>Abrir ficha</a>
                  <div style={metaStyle}>Recursos: {row.resources.length ? row.resources.join(", ") : "-"}</div>
                  <div style={metaStyle}>Asignaciones: {row.assignmentCount} · Min trazados: {row.assignmentMinutes ?? "-"}</div>
                </div>
              </div>

              {row.note ? <div style={noteStyle}>{row.note}</div> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <article style={metricCardStyle}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a" }}>{value}</div>
    </article>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 16,
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ecfeff 100%)",
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f766e",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  color: "#475569",
  lineHeight: 1.5,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const metricCardStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 6,
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 14,
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "10px 12px",
  background: "#fff",
};

const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#f8fafc",
  display: "grid",
  gap: 10,
};

const noteStyle: CSSProperties = {
  borderRadius: 14,
  background: "#fff",
  border: "1px solid #e2e8f0",
  padding: "10px 12px",
  color: "#334155",
  whiteSpace: "pre-wrap",
};

const metaStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const pillStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const neutralPill: CSSProperties = {
  ...pillStyle,
  background: "#fff",
  border: "1px solid #dbe4ea",
  color: "#334155",
};

const errorStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  padding: "10px 12px",
  fontWeight: 700,
};

const darkBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
};

const ghostBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
};

const linkBtn: CSSProperties = {
  ...ghostBtn,
  textAlign: "center",
};
