// src/app/hr/payroll/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PayrollStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELED";

type EmployeeLite = {
  id: string;
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
  internshipHoursTotal?: number | null;
  internshipHoursUsed?: number | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
};

type PayrollRow = {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  amountCents: number;
  concept: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
    jobTitle: string | null;
  };
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
};

type PayrollCalculationResponse = {
  ok: true;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
    jobTitle: string | null;
    isActive: boolean;
    internshipHoursTotal?: number | null;
    internshipHoursUsed?: number | null;
    internshipStartDate?: string | null;
    internshipEndDate?: string | null;
  };
  period: {
    periodStart: string;
    periodEnd: string;
  };
  summary: {
    workedMinutes: number;
    workedHours: number;
    workedDays: number;
    workedShifts: number;
    approvedLogsCount: number;
  };
  internship: {
    isIntern: boolean;
    internshipHoursTotal: number | null;
    internshipHoursUsed: number | null;
    internshipHoursWorkedThisPeriod: number;
    internshipHoursRemaining: number | null;
  } | null;
  rate: {
    id: string;
    rateType: string;
    amountCents: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    note: string | null;
  } | null;
  calculation: {
    supported: boolean;
    suggestedAmountCents: number;
    suggestedAmountEur: string;
    calculationBase?: string;
    message: string | null;
  };
  logs: Array<{
    id: string;
    workDate: string;
    workedMinutes: number | null;
    status: string;
    area: string;
    note: string | null;
  }>;
};

const PAYROLL_STATUSES: PayrollStatus[] = ["DRAFT", "PENDING", "PAID", "CANCELED"];

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
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

function statusStyle(status: PayrollStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };
  if (status === "DRAFT") return { ...base, borderColor: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };
  if (status === "PENDING") return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  if (status === "PAID") return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  if (status === "CANCELED") return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  return base;
}

export default function HrPayrollPage() {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<"" | PayrollStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollRow | null>(null);

  const [openCalc, setOpenCalc] = useState(false);
  const [calcEmployeeId, setCalcEmployeeId] = useState("");
  const [calcPeriodStart, setCalcPeriodStart] = useState("");
  const [calcPeriodEnd, setCalcPeriodEnd] = useState("");
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<PayrollCalculationResponse | null>(null);
  const [prefillPayroll, setPrefillPayroll] = useState<{
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    status: PayrollStatus;
    amountCents: string;
    concept: string | null;
    note: string | null;
    paidAt: string;
  } | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (employeeId) p.set("employeeId", employeeId);
    if (status) p.set("status", status);
    if (from) p.set("from", new Date(`${from}T00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59`).toISOString());
    return p.toString();
  }, [employeeId, status, from, to]);

  const payableEmployees = useMemo(
    () => employees.filter((e) => e.kind !== "INTERN"),
    [employees]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payRes, empRes] = await Promise.all([
        fetch(`/api/hr/payroll?${query}`, { cache: "no-store" }),
        fetch(`/api/hr/employees?isActive=true`, { cache: "no-store" }),
      ]);

      if (!payRes.ok) throw new Error(await payRes.text());
      if (!empRes.ok) throw new Error(await empRes.text());

      const payJson = await payRes.json();
      const empJson = await empRes.json();

      setRows(payJson.rows ?? []);
      setEmployees(empJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando pagos");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const totalShown = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amountCents ?? 0), 0),
    [rows]
  );

  async function runCalculation() {
    try {
      setCalcBusy(true);
      setCalcError(null);
      setCalcResult(null);

      if (!calcEmployeeId) throw new Error("Selecciona un trabajador.");
      if (!calcPeriodStart || !calcPeriodEnd) throw new Error("Selecciona el periodo.");

      const qs = new URLSearchParams({
        employeeId: calcEmployeeId,
        periodStart: new Date(`${calcPeriodStart}T00:00`).toISOString(),
        periodEnd: new Date(`${calcPeriodEnd}T23:59`).toISOString(),
      });

      const res = await fetch(`/api/hr/payroll/calculate?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(await res.text());

      const json = (await res.json()) as PayrollCalculationResponse;
      setCalcResult(json);
    } catch (e: unknown) {
      setCalcError(e instanceof Error ? e.message : "Error calculando pago");
    } finally {
      setCalcBusy(false);
    }
  }

  function openPaymentFromCalculation() {
    if (!calcResult) return;

    const employee = employees.find((e) => e.id === calcResult.employee.id);
    if (!employee) return;

    const fakeRow: PayrollRow | null = null;
    setEditing(fakeRow);

    const payload = {
      employeeId: calcResult.employee.id,
      periodStart: fmtDateInput(calcResult.period.periodStart),
      periodEnd: fmtDateInput(calcResult.period.periodEnd),
      status: "DRAFT" as PayrollStatus,
      amountCents: String(calcResult.calculation.suggestedAmountCents),
      concept: calcResult.calculation.supported
        ? `Cálculo asistido desde jornadas APPROVED · ${calcResult.calculation.calculationBase ?? ""}`
        : calcResult.calculation.message ?? "Cálculo no remunerado",
      note: calcResult.calculation.message ?? null,
      paidAt: "",
    };

    setPrefillPayroll(payload);
    setOpenCalc(false);
    setOpen(true);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 30 }}>Pagos</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>
            Liquidaciones, pagos pendientes y estado
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/hr" style={linkBtn}>← RRHH</a>
          <button type="button" onClick={() => load()} style={ghostBtn}>Refrescar</button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setPrefillPayroll(null);
              setOpen(true);
            }}
            style={primaryBtn}
          >
            Nuevo pago
          </button>
        </div>
          <button
            type="button"
            onClick={() => {
              setCalcEmployeeId(employeeId || "");
              setCalcPeriodStart(from || "");
              setCalcPeriodEnd(to || "");
              setCalcError(null);
              setCalcResult(null);
              setOpenCalc(true);
            }}
            style={ghostBtn}
          >
            Calcular desde horas
          </button>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 18,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <Field label="Trabajador">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {payableEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | PayrollStatus)} style={inputStyle}>
            <option value="">Todos</option>
            {PAYROLL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </Field>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "10px 12px",
            background: "#fafafa",
            fontWeight: 900,
          }}
        >
          {eur(totalShown)}
        </div>

        <button type="button" onClick={() => load()} style={primaryBtn}>
          Aplicar
        </button>
      </div>

      {loading ? <div>Cargando…</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={emptyBox}>No hay pagos para los filtros seleccionados.</div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setEditing(r);
              setOpen(true);
            }}
            style={{
              textAlign: "left",
              border: "1px solid #eee",
              background: "#fff",
              borderRadius: 16,
              padding: 14,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <a
                  href={`/hr/employees/${r.employee.id}`}
                  style={{ textDecoration: "none", color: "#111", fontWeight: 950, fontSize: 18 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.employee.fullName}
                </a>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {r.employee.kind}
                  {r.employee.jobTitle ? ` · ${r.employee.jobTitle}` : ""}
                  {r.employee.code ? ` · ${r.employee.code}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={statusStyle(r.status)}>{r.status}</div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>{eur(r.amountCents)}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <Mini label="Periodo desde" value={fmtDate(r.periodStart)} />
              <Mini label="Periodo hasta" value={fmtDate(r.periodEnd)} />
              <Mini label="Pagado el" value={fmtDate(r.paidAt)} />
              <Mini label="Creado" value={fmtDate(r.createdAt)} />
            </div>

            {r.concept ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Concepto: {r.concept}</div> : null}
            {r.note ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>Nota: {r.note}</div> : null}
          </button>
        ))}
      </div>

      {open ? (
        <PayrollModal
          initial={editing}
          prefill={prefillPayroll}
          employees={employees}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            setPrefillPayroll(null);
            await load();
          }}
        />
      ) : null}

      {prefillPayroll ? (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontWeight: 900,
          }}
        >
          Pago pre-rellenado desde cálculo asistido. Revisa importe, periodo y concepto antes de guardar.
        </div>
      ) : null}

      {openCalc ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => (calcBusy ? null : setOpenCalc(false))}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Cálculo asistido de pago</div>
              <button type="button" onClick={() => setOpenCalc(false)} style={ghostBtn}>
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <Field label="Trabajador">
                <select value={calcEmployeeId} onChange={(e) => setCalcEmployeeId(e.target.value)} style={inputStyle}>
                  <option value="">Selecciona trabajador…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Periodo desde">
                <input type="date" value={calcPeriodStart} onChange={(e) => setCalcPeriodStart(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Periodo hasta">
                <input type="date" value={calcPeriodEnd} onChange={(e) => setCalcPeriodEnd(e.target.value)} style={inputStyle} />
              </Field>

              <button type="button" onClick={runCalculation} disabled={calcBusy} style={primaryBtn}>
                {calcBusy ? "Calculando..." : "Calcular"}
              </button>
            </div>

            {calcError ? <div style={{ ...errorBox, marginTop: 12 }}>{calcError}</div> : null}

            {calcResult ? (
              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#fafafa",
                    borderRadius: 14,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: 18 }}>{calcResult.employee.fullName}</div>

                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    {calcResult.employee.kind}
                    {calcResult.employee.jobTitle ? ` · ${calcResult.employee.jobTitle}` : ""}
                    {calcResult.employee.code ? ` · ${calcResult.employee.code}` : ""}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <Mini label="Horas aprobadas" value={calcResult.summary.workedHours.toFixed(2)} />
                    <Mini label="Minutos aprobados" value={String(calcResult.summary.workedMinutes)} />
                    <Mini label="Días aprobados" value={String(calcResult.summary.workedDays)} />
                    <Mini label="Turnos aprobados" value={String(calcResult.summary.workedShifts)} />
                    <Mini label="Registros aprobados" value={String(calcResult.summary.approvedLogsCount)} />
                  </div>

                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #dbeafe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    El cálculo usa solo jornadas en estado APPROVED. Los registros OPEN, CLOSED o CANCELED no entran en payroll.
                  </div>

                  {calcResult.rate ? (
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      Tarifa: <b>{calcResult.rate.rateType}</b> · {(calcResult.rate.amountCents / 100).toFixed(2)} €
                    </div>
                  ) : null}

                  {calcResult.internship ? (
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      Bolsa prácticas:
                      {" "}total <b>{calcResult.internship.internshipHoursTotal ?? "—"} h</b>
                      {" · "}usadas <b>{calcResult.internship.internshipHoursUsed ?? "—"} h</b>
                      {" · "}restantes <b>{calcResult.internship.internshipHoursRemaining ?? "—"} h</b>
                    </div>
                  ) : null}

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: calcResult.calculation.supported ? "1px solid #bbf7d0" : "1px solid #fde68a",
                      background: calcResult.calculation.supported ? "#f0fdf4" : "#fffbeb",
                      fontWeight: 900,
                    }}
                  >
                    {calcResult.calculation.supported ? (
                      <>
                        Pago sugerido: {calcResult.calculation.suggestedAmountEur} €
                        {calcResult.calculation.calculationBase ? ` · ${calcResult.calculation.calculationBase}` : ""}
                      </>
                    ) : (
                      calcResult.calculation.message
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setOpenCalc(false)} style={ghostBtn}>
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={openPaymentFromCalculation}
                    disabled={!!calcResult?.internship?.isIntern}
                    style={{
                      ...primaryBtn,
                      background: calcResult?.internship?.isIntern ? "#9ca3af" : "#111",
                      borderColor: calcResult?.internship?.isIntern ? "#9ca3af" : "#111",
                      cursor: calcResult?.internship?.isIntern ? "not-allowed" : "pointer",
                    }}
                  >
                    Usar en nuevo pago
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayrollModal({
  initial,
  prefill,
  employees,
  onClose,
  onSaved,
}: {
  initial: PayrollRow | null;
  prefill: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    status: PayrollStatus;
    amountCents: string;
    concept: string | null;
    note: string | null;
    paidAt: string;
  } | null;
  employees: EmployeeLite[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {

  const isEdit = !!initial;

  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? prefill?.employeeId ?? "");
  const [periodStart, setPeriodStart] = useState(fmtDateInput(initial?.periodStart ?? null) || prefill?.periodStart || "");
  const [periodEnd, setPeriodEnd] = useState(fmtDateInput(initial?.periodEnd ?? null) || prefill?.periodEnd || "");
  const [status, setStatus] = useState<PayrollStatus>(initial?.status ?? prefill?.status ?? "DRAFT");
  const [amountCents, setAmountCents] = useState(String(initial?.amountCents ?? prefill?.amountCents ?? ""));
  const [concept, setConcept] = useState(initial?.concept ?? prefill?.concept ?? "");
  const [note, setNote] = useState(initial?.note ?? prefill?.note ?? "");
  const [paidAt, setPaidAt] = useState(fmtDateInput(initial?.paidAt ?? null) || prefill?.paidAt || "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      if (!isEdit && !employeeId) throw new Error("Selecciona un trabajador.");
      if (!periodStart || !periodEnd) throw new Error("Periodo obligatorio.");
      if (!amountCents.trim()) throw new Error("Importe obligatorio.");

      const selectedEmployee = employees.find((e) => e.id === employeeId);
      if (!isEdit && selectedEmployee?.kind === "INTERN") {
        throw new Error("Los trabajadores en prácticas no generan pagos.");
      }

      const body = isEdit
        ? {
            status,
            amountCents: Number(amountCents),
            concept: concept.trim() || null,
            note: note.trim() || null,
            paidAt: paidAt ? new Date(`${paidAt}T00:00`).toISOString() : null,
          }
        : {
            employeeId,
            periodStart: new Date(`${periodStart}T00:00`).toISOString(),
            periodEnd: new Date(`${periodEnd}T00:00`).toISOString(),
            status,
            amountCents: Number(amountCents),
            concept: concept.trim() || null,
            note: note.trim() || null,
            paidAt: paidAt ? new Date(`${paidAt}T00:00`).toISOString() : null,
          };

      const res = await fetch(isEdit ? `/api/hr/payroll/${initial!.id}` : `/api/hr/payroll`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando pago");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar pago" : "Nuevo pago"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {!isEdit ? (
          <Field label="Trabajador">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
              <option value="">Selecciona trabajador…</option>
              {employees.filter((e) => e.kind !== "INTERN").map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Trabajador">
            <input value={initial?.employee.fullName ?? ""} readOnly style={inputStyle} />
          </Field>
        )}

        {!isEdit ? (
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as PayrollStatus)} style={inputStyle}>
              {PAYROLL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as PayrollStatus)} style={inputStyle}>
              {PAYROLL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isEdit ? (
          <>
            <Field label="Periodo desde">
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Periodo hasta">
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Periodo desde">
              <input value={fmtDateInput(initial?.periodStart ?? null)} readOnly style={inputStyle} />
            </Field>

            <Field label="Periodo hasta">
              <input value={fmtDateInput(initial?.periodEnd ?? null)} readOnly style={inputStyle} />
            </Field>
          </>
        )}

        <Field label="Importe (céntimos)">
          <input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Pagado el">
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Concepto">
          <input value={concept} onChange={(e) => setConcept(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Nota" full>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}

      <ModalActions onClose={onClose} onSave={save} busy={busy} />
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  onSave,
  busy,
}: {
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button type="button" onClick={onClose} style={ghostBtn}>
        Cancelar
      </button>
      <button type="button" onClick={onSave} disabled={busy} style={{ ...primaryBtn, background: busy ? "#9ca3af" : "#111" }}>
        {busy ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>
      {label}
      {children}
    </label>
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

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
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

const emptyBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 16,
  padding: 18,
};