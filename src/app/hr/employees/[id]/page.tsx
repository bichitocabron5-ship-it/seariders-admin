// src/app/hr/employees/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DetailResponse = {
  ok: true;
  row: {
    id: string;
    code: string | null;
    fullName: string;
    phone: string | null;
    email: string | null;
    kind: string;
    jobTitle: string | null;
    isActive: boolean;
    note: string | null;

    hireDate: string | null;
    terminationDate: string | null;

    internshipHoursTotal: number | null;
    internshipHoursUsed: number | null;
    internshipStartDate: string | null;
    internshipEndDate: string | null;

    userId: string | null;
    user: {
      id: string;
      username: string;
      fullName: string | null;
      isActive: boolean;
    } | null;

    workLogs: Array<{
      id: string;
      workDate: string;
      checkInAt: string | null;
      checkOutAt: string | null;
      breakMinutes: number;
      workedMinutes: number | null;
      area: string;
      status: string;
      note: string | null;
      approvedByUserId: string | null;
      approvedByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
      createdAt: string;
      updatedAt: string;
    }>;

    rates: Array<{
      id: string;
      rateType: string;
      amountCents: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      note: string | null;
      createdAt: string;
      createdByUserId: string | null;
      createdByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
    }>;

    payrollEntries: Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      status: string;
      amountCents: number;
      concept: string | null;
      note: string | null;
      paidAt: string | null;
      createdAt: string;
      createdByUserId: string | null;
      createdByUser: {
        id: string;
        username: string | null;
        fullName: string | null;
      } | null;
    }>;

    createdAt: string;
    updatedAt: string;
  };
  summary: {
    workedMinutesTotal: number;
    payrollTotalCents: number;
    internshipRemaining: number | null;
  };
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso;
  }
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

function fmtMinutes(total: number | null) {
  if (total === null || total === undefined) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
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
      return "RRHH";
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

function rateTypeLabel(t: string) {
  if (t === "HOURLY") return "Por hora";
  if (t === "DAILY") return "Por día";
  if (t === "MONTHLY") return "Mensual";
  if (t === "PER_SHIFT") return "Por turno";
  return t;
}

function statusBadge(text: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (text === "ACTIVE" || text === "PAID" || text === "APPROVED") {
    return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  }
  if (text === "OPEN" || text === "PENDING") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (text === "CANCELED") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  if (text === "CLOSED" || text === "DRAFT") {
    return { ...base, borderColor: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };
  }
  return base;
}

export default function HrEmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/hr/employees/${id}/detail`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as DetailResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando ficha");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const title = useMemo(() => data?.row.fullName ?? "Trabajador", [data]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button
            type="button"
            onClick={() => router.push("/hr")}
            style={ghostBtn}
          >
            ← RRHH
          </button>

          <div style={{ marginTop: 10, fontWeight: 950, fontSize: 30 }}>{title}</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>
            Ficha individual del trabajador
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => load()} style={ghostBtn}>
            Refrescar
          </button>
          <a href="/hr/worklogs" style={linkBtn}>Fichajes</a>
          <a href="/hr/rates" style={linkBtn}>Tarifas</a>
          <a href="/hr/payroll" style={linkBtn}>Pagos</a>
        </div>
      </div>

      {loading ? <div>Cargando…</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && data ? (
        <>
          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 24 }}>{data.row.fullName}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {employeeKindLabel(data.row.kind)}
                  {data.row.jobTitle ? ` · ${data.row.jobTitle}` : ""}
                  {data.row.code ? ` · ${data.row.code}` : ""}
                </div>
              </div>

              <div style={statusBadge(data.row.isActive ? "ACTIVE" : "CANCELED")}>
                {data.row.isActive ? "Activo" : "Inactivo"}
              </div>
            </div>

            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Email: <b>{data.row.email ?? "—"}</b>
              {" · "}Teléfono: <b>{data.row.phone ?? "—"}</b>
              {" · "}Alta: <b>{fmtDate(data.row.hireDate)}</b>
              {" · "}Baja: <b>{fmtDate(data.row.terminationDate)}</b>
            </div>

            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Usuario vinculado:{" "}
              <b>{data.row.user ? `${data.row.user.username}${data.row.user.fullName ? ` · ${data.row.user.fullName}` : ""}` : "No vinculado"}</b>
            </div>

            {data.row.note ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Nota: {data.row.note}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {data.row.kind === "INTERN" ? (
              <>
                <Kpi title="Horas registradas" value={fmtMinutes(data.summary.workedMinutesTotal)} warning />
                <Kpi title="Bolsa total" value={data.row.internshipHoursTotal ?? "—"} warning />
                <Kpi title="Bolsa usada" value={data.row.internshipHoursUsed ?? 0} warning />
                <Kpi title="Bolsa restante" value={data.summary.internshipRemaining ?? "—"} warning />
              </>
            ) : (
              <>
                <Kpi title="Horas registradas" value={fmtMinutes(data.summary.workedMinutesTotal)} />
                <Kpi title="Pagado acumulado" value={eur(data.summary.payrollTotalCents)} />
                <Kpi title="Fichajes recientes" value={data.row.workLogs.length} />
                <Kpi title="Tarifas" value={data.row.rates.length} />
              </>
            )}
          </div>

          {data.row.kind === "Prácticas" ? (
            <div
              style={{
                border: "1px solid #fde68a",
                background: "#fffbeb",
                borderRadius: 18,
                padding: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 20, color: "#92400e" }}>
                Bolsa de horas · Prácticas
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <Kpi title="Horas totales" value={data.row.internshipHoursTotal ?? "—"} warning />
                <Kpi title="Horas usadas" value={data.row.internshipHoursUsed ?? 0} warning />
                <Kpi title="Horas restantes" value={data.summary.internshipRemaining ?? "—"} warning />
                <Kpi title="Inicio prácticas" value={fmtDate(data.row.internshipStartDate)} warning />
                <Kpi title="Fin prácticas" value={fmtDate(data.row.internshipEndDate)} warning />
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            <section style={cardStyle}>
              <div style={sectionTitle}>Últimos fichajes</div>

              {data.row.workLogs.length === 0 ? (
                <div style={{ opacity: 0.72 }}>Sin fichajes todavía.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {data.row.workLogs.map((l) => (
                    <div key={l.id} style={itemStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>
                          {fmtDate(l.workDate)} · {l.area}
                        </div>
                        <div style={statusBadge(l.status)}>{l.status}</div>
                      </div>

                      <div style={subLineStyle}>
                        Entrada: <b>{fmtDateTime(l.checkInAt)}</b>
                        {" · "}Salida: <b>{fmtDateTime(l.checkOutAt)}</b>
                      </div>

                      <div style={subLineStyle}>
                        Descanso: <b>{l.breakMinutes} min</b>
                        {" · "}Trabajado: <b>{fmtMinutes(l.workedMinutes)}</b>
                      </div>

                      {l.note ? <div style={{ marginTop: 6, fontSize: 12 }}>{l.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div style={{ display: "grid", gap: 16 }}>
              {data.row.kind === "INTERN" ? (
                <section style={cardStyle}>
                  <div style={sectionTitle}>Resumen de prácticas</div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={itemStyle}>
                      <div style={{ fontWeight: 900 }}>Bolsa de horas</div>
                      <div style={subLineStyle}>
                        Total: <b>{data.row.internshipHoursTotal ?? "—"}</b>
                        {" · "}Usadas: <b>{data.row.internshipHoursUsed ?? 0}</b>
                        {" · "}Restantes: <b>{data.summary.internshipRemaining ?? "—"}</b>
                      </div>
                    </div>

                    <div style={itemStyle}>
                      <div style={{ fontWeight: 900 }}>Periodo de prácticas</div>
                      <div style={subLineStyle}>
                        Inicio: <b>{fmtDate(data.row.internshipStartDate)}</b>
                        {" · "}Fin: <b>{fmtDate(data.row.internshipEndDate)}</b>
                      </div>
                    </div>

                    <div
                      style={{
                        ...itemStyle,
                        border:
                          data.summary.internshipRemaining !== null && data.summary.internshipRemaining <= 20
                            ? "1px solid #fde68a"
                            : "1px solid #eee",
                        background:
                          data.summary.internshipRemaining !== null && data.summary.internshipRemaining <= 20
                            ? "#fffbeb"
                            : "#fafafa",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>Estado de la bolsa</div>
                      <div style={subLineStyle}>
                        {data.summary.internshipRemaining === null
                          ? "Bolsa sin definir"
                          : data.summary.internshipRemaining <= 0
                          ? "Bolsa agotada"
                          : data.summary.internshipRemaining <= 20
                          ? "Quedan pocas horas"
                          : "Bolsa correcta"}
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <section style={cardStyle}>
                    <div style={sectionTitle}>Tarifas</div>

                    {data.row.rates.length === 0 ? (
                      <div style={{ opacity: 0.72 }}>Sin tarifas registradas.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {data.row.rates.map((r) => (
                          <div key={r.id} style={itemStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ fontWeight: 900 }}>{rateTypeLabel(r.rateType)}</div>
                              <div style={{ fontWeight: 950 }}>{eur(r.amountCents)}</div>
                            </div>

                            <div style={subLineStyle}>
                              Desde: <b>{fmtDate(r.effectiveFrom)}</b>
                              {" · "}Hasta: <b>{fmtDate(r.effectiveTo)}</b>
                            </div>

                            {r.note ? <div style={{ marginTop: 6, fontSize: 12 }}>{r.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section style={cardStyle}>
                    <div style={sectionTitle}>Pagos</div>

                    {data.row.payrollEntries.length === 0 ? (
                      <div style={{ opacity: 0.72 }}>Sin pagos registrados.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {data.row.payrollEntries.map((p) => (
                          <div key={p.id} style={itemStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900 }}>
                                {fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={statusBadge(p.status)}>{p.status}</div>
                                <div style={{ fontWeight: 950 }}>{eur(p.amountCents)}</div>
                              </div>
                            </div>

                            <div style={subLineStyle}>
                              Pagado el: <b>{fmtDate(p.paidAt)}</b>
                            </div>

                            {p.concept ? <div style={{ marginTop: 6, fontSize: 12 }}>Concepto: {p.concept}</div> : null}
                            {p.note ? <div style={{ marginTop: 4, fontSize: 12 }}>Nota: {p.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({
  title,
  value,
  warning,
}: {
  title: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        border: warning ? "1px solid #fde68a" : "1px solid #e5e7eb",
        background: warning ? "#fffbeb" : "#fff",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 950,
          color: warning ? "#92400e" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const linkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
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

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
};

const itemStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
};

const subLineStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.85,
};