// src/app/hr/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardResponse = {
  ok: true;
  summary: {
    totalActiveEmployees: number;
    presentToday: number;
    openToday: number;
    closedToday: number;
    workedMinutesToday: number;
    pendingPayrollCount: number;
    pendingPayrollAmountCents: number;
  };
  alerts: {
    internship: Array<{
      employeeId: string;
      fullName: string;
      code: string | null;
      total: number | null;
      used: number;
      remaining: number | null;
      level: "info" | "warn" | "danger";
    }>;
    openWorklogs: Array<{
      id: string;
      employeeId: string;
      fullName: string;
      area: string;
      checkInAt: string | null;
    }>;
    pendingPayroll: Array<{
      id: string;
      amountCents: number;
      status: string;
      periodStart: string;
      periodEnd: string;
      employee: {
        id: string;
        fullName: string;
        code: string | null;
        kind: string;
      };
    }>;
    withoutRate: Array<{
      id: string;
      fullName: string;
      code: string | null;
      kind: string;
    }>;
    withoutUser: Array<{
      id: string;
      fullName: string;
      code: string | null;
      kind: string;
    }>;
  };
  activeByKind: Array<{
    kind: string;
    count: number;
  }>;
  todayLogs: Array<{
    id: string;
    employeeId: string;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    breakMinutes: number;
    workedMinutes: number | null;
    area: string;
    status: string;
    note: string | null;
    employee: {
      id: string;
      code: string | null;
      fullName: string;
      kind: string;
      jobTitle: string | null;
      isActive: boolean;
    };
  }>;
};

const pageShell: React.CSSProperties = {
  maxWidth: 1360,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 16,
  fontFamily: "system-ui",
};

const softCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
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

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
  textDecoration: "none",
};

function alertBoxStyle(level: "info" | "warn" | "danger"): React.CSSProperties {
  if (level === "danger") {
    return {
      border: "1px solid #fecaca",
      background: "#fff1f2",
      borderRadius: 14,
      padding: 12,
    };
  }
  if (level === "warn") {
    return {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      borderRadius: 14,
      padding: 12,
    };
  }
  return {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    borderRadius: 14,
    padding: 12,
  };
}

function eur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { dateStyle: "short" });
  } catch {
    return iso;
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

function worklogStatusLabel(status: string) {
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

function payrollStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "PAID":
      return "Pagado";
    case "CANCELED":
      return "Cancelado";
    default:
      return status;
  }
}

function fmtMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

function statusStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (status === "OPEN" || status === "PENDING") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (status === "APPROVED" || status === "PAID") {
    return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  }
  if (status === "CLOSED") {
    return { ...base, borderColor: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };
  }
  if (status === "CANCELED") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  return base;
}

export default function HrHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/hr/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as DashboardResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando RR. HH.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const orderedKinds = useMemo(() => {
    return [...(data?.activeByKind ?? [])].sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div style={pageShell}>
      <div
        style={{
          ...softCard,
          padding: 16,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 30 }}>RR. HH.</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>
            Operativa diaria, fichajes, horas y pagos
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => load()} style={ghostBtn}>
            Refrescar
          </button>
          <Link href="/hr/worklogs" style={primaryBtn}>Fichajes</Link>
          <Link href="/admin/hr" style={ghostBtn}>Trabajadores</Link>
          <Link href="/admin/users" style={ghostBtn}>Usuarios</Link>
        </div>
      </div>

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}
      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Kpi title="Trabajadores activos" value={data.summary.totalActiveEmployees} />
            <Kpi title="Presentes hoy" value={data.summary.presentToday} />
            <Kpi title="Jornadas abiertas" value={data.summary.openToday} danger={data.summary.openToday > 0} />
            <Kpi title="Jornadas cerradas" value={data.summary.closedToday} />
            <Kpi title="Horas hoy" value={fmtMinutes(data.summary.workedMinutesToday)} />
            <Kpi
              title="Pagos pendientes"
              value={`${data.summary.pendingPayrollCount} · ${eur(data.summary.pendingPayrollAmountCents)}`}
              danger={data.summary.pendingPayrollCount > 0}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {data.alerts.internship.filter((a) => a.level !== "info").length > 0 ? (
              <AlertSection title="Alertas de prácticas" tone="warn">
                {data.alerts.internship
                  .filter((a) => a.level !== "info")
                  .map((a) => (
                    <Link
                      key={a.employeeId}
                      href={`/hr/employees/${a.employeeId}`}
                      style={{ ...alertBoxStyle(a.level), textDecoration: "none", color: "#111" }}
                    >
                      <b>{a.fullName}</b>
                      {a.code ? ` · ${a.code}` : ""}
                      {` · usadas `}<b>{a.used}</b>
                      {` / totales `}<b>{a.total ?? "—"}</b>
                      {` · restantes `}<b>{a.remaining ?? "—"}</b>
                    </Link>
                  ))}
              </AlertSection>
            ) : null}

            {data.alerts.openWorklogs.length > 0 ? (
              <AlertSection title="Jornadas abiertas" tone="warn">
                {data.alerts.openWorklogs.map((a) => (
                  <Link
                    key={a.id}
                    href={`/hr/employees/${a.employeeId}`}
                    style={{ ...alertBoxStyle("warn"), textDecoration: "none", color: "#111" }}
                  >
                    <b>{a.fullName}</b>
                    {` · área `}<b>{a.area}</b>
                    {` · entrada `}<b>{fmtDateTime(a.checkInAt)}</b>
                  </Link>
                ))}
              </AlertSection>
            ) : null}

            {data.alerts.pendingPayroll.length > 0 ? (
              <AlertSection title="Nóminas pendientes" tone="info">
                {data.alerts.pendingPayroll.map((p) => (
                  <Link
                    key={p.id}
                    href="/hr/payroll"
                    style={{ ...alertBoxStyle("info"), textDecoration: "none", color: "#111" }}
                  >
                    <b>{p.employee.fullName}</b>
                    {p.employee.code ? ` · ${p.employee.code}` : ""}
                    {` · ${employeeKindLabel(p.employee.kind)}`}
                    {` · ${fmtDate(p.periodStart)} a ${fmtDate(p.periodEnd)}`}
                    {` · `}<b>{eur(p.amountCents)}</b>
                    {` · estado `}<b>{payrollStatusLabel(p.status)}</b>
                  </Link>
                ))}
              </AlertSection>
            ) : null}

            {data.alerts.withoutRate.length > 0 ? (
              <AlertSection title="Trabajadores sin tarifa" tone="info">
                {data.alerts.withoutRate.map((a) => (
                  <Link
                    key={a.id}
                    href={`/hr/employees/${a.id}`}
                    style={{ ...alertBoxStyle("info"), textDecoration: "none", color: "#111" }}
                  >
                    <b>{a.fullName}</b>
                    {a.code ? ` · ${a.code}` : ""}
                    {` · ${employeeKindLabel(a.kind)}`}
                  </Link>
                ))}
              </AlertSection>
            ) : null}

            {data.alerts.withoutUser.length > 0 ? (
              <AlertSection title="Trabajadores sin usuario" tone="danger">
                {data.alerts.withoutUser.map((a) => (
                  <Link
                    key={a.id}
                    href={`/hr/employees/${a.id}`}
                    style={{ ...alertBoxStyle("danger"), textDecoration: "none", color: "#111" }}
                  >
                    <b>{a.fullName}</b>
                    {a.code ? ` · ${a.code}` : ""}
                    {` · ${employeeKindLabel(a.kind)}`}
                  </Link>
                ))}
              </AlertSection>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.95fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 20 }}>Fichajes del día</div>
                  <div style={{ fontSize: 12, opacity: 0.72 }}>Pulso operativo de la jornada actual</div>
                </div>
                <Link href="/hr/worklogs" style={ghostBtn}>Ver fichajes</Link>
              </div>

              {data.todayLogs.length === 0 ? (
                <div style={{ opacity: 0.72 }}>No hay fichajes hoy todavía.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.todayLogs.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        padding: 14,
                        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{l.employee.fullName}</div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            {employeeKindLabel(l.employee.kind)}
                            {l.employee.jobTitle ? ` · ${l.employee.jobTitle}` : ""}
                            {l.employee.code ? ` · ${l.employee.code}` : ""}
                          </div>
                        </div>

                        <div style={statusStyle(l.status)}>{worklogStatusLabel(l.status)}</div>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <Mini label="Entrada" value={fmtDateTime(l.checkInAt)} />
                        <Mini label="Salida" value={fmtDateTime(l.checkOutAt)} />
                        <Mini label="Descanso" value={`${l.breakMinutes} min`} />
                        <Mini label="Trabajado" value={l.workedMinutes != null ? fmtMinutes(l.workedMinutes) : "—"} />
                        <Mini label="Área" value={l.area} />
                      </div>

                      {l.note ? (
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                          Nota: {l.note}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 20 }}>Distribución activa</div>
                  <div style={{ fontSize: 12, opacity: 0.72 }}>Plantilla activa por perfil</div>
                </div>

                {orderedKinds.length === 0 ? (
                  <div style={{ opacity: 0.72 }}>Sin datos.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {orderedKinds.map((k) => (
                      <div
                        key={k.kind}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{employeeKindLabel(k.kind)}</div>
                        <div>{k.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...softCard, padding: 16, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 20 }}>Accesos rápidos</div>
                  <div style={{ fontSize: 12, opacity: 0.72 }}>Navegación operativa del módulo</div>
                </div>

                <QuickLink href="/admin/hr" label="Gestión de trabajadores" />
                <QuickLink href="/admin/users" label="Usuarios y accesos" />
                <QuickLink href="/hr/rates" label="Tarifas" />
                <QuickLink href="/hr/payroll" label="Pagos" />
                <QuickLink href="/hr/worklogs" label="Fichajes" />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AlertSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "info" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const palette =
    tone === "danger"
      ? { border: "#fecaca", background: "#fff1f2", color: "#991b1b" }
      : tone === "warn"
        ? { border: "#fde68a", background: "#fffbeb", color: "#92400e" }
        : { border: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };

  return (
    <div style={{ ...softCard, border: `1px solid ${palette.border}`, background: palette.background, padding: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 20, color: palette.color }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Kpi({
  title,
  value,
  danger,
}: {
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        ...softCard,
        border: danger ? "1px solid #fecaca" : "1px solid #dbe4ea",
        background: danger ? "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)" : "#fff",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 950,
          color: danger ? "#b91c1c" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "#111",
        border: "1px solid #e5e7eb",
        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
        borderRadius: 12,
        padding: "10px 12px",
        fontWeight: 900,
      }}
    >
      {label}
    </Link>
  );
}
