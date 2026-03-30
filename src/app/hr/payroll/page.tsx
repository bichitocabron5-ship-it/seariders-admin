// src/app/hr/payroll/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import { PayrollCalculationModal } from "./_components/PayrollCalculationModal";
import { PayrollListSection } from "./_components/PayrollListSection";
import { PayrollEditorModal } from "./_components/PayrollEditorModal";

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

function formatEur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function formatDateSafe(iso: string | null) {
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
    <div style={pageShell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: "clamp(30px, 4vw, 38px)", lineHeight: 1 }}>Pagos</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>
            Liquidaciones, pagos pendientes y estado
          </div>
        </div>

        <div style={opsStyles.actionGrid}>
          <a href="/hr" style={linkBtn}>← RR. HH.</a>
          <button type="button" onClick={() => load()} style={ghostBtn}>Refrescar</button>
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
          {formatEur(totalShown)}
        </div>

        <button type="button" onClick={() => load()} style={primaryBtn}>
          Aplicar
        </button>
      </div>

      {loading ? <div>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={emptyBox}>No hay pagos para los filtros seleccionados.</div>
      ) : null}
      <PayrollListSection
        rows={rows}
        onSelect={(row) => {
          setEditing(row);
          setOpen(true);
        }}
        formatEur={formatEur}
        formatDateSafe={formatDateSafe}
        statusStyle={statusStyle}
      />

      {open ? (

        <PayrollEditorModal
          initial={editing}
          prefill={prefillPayroll}
          employees={employees}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            setPrefillPayroll(null);
            await load();
          }}
          inputStyle={inputStyle}
          ghostBtn={ghostBtn}
          primaryBtn={primaryBtn}
          errorBox={errorBox}
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
          Pago prerrellenado desde cálculo asistido. Revisa importe, período y concepto antes de guardar.
        </div>
      ) : null}
      <PayrollCalculationModal
        open={openCalc}
        employees={employees}
        calcEmployeeId={calcEmployeeId}
        calcPeriodStart={calcPeriodStart}
        calcPeriodEnd={calcPeriodEnd}
        calcBusy={calcBusy}
        calcError={calcError}
        calcResult={calcResult}
        onClose={() => setOpenCalc(false)}
        onEmployeeChange={setCalcEmployeeId}
        onPeriodStartChange={setCalcPeriodStart}
        onPeriodEndChange={setCalcPeriodEnd}
        onRunCalculation={runCalculation}
        onUseInNewPayroll={openPaymentFromCalculation}
        inputStyle={inputStyle}
        ghostBtn={ghostBtn}
        primaryBtn={primaryBtn}
        errorBox={errorBox}
      />
    </div>
  );
}

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1360px, 100%)",
  gap: 16,
};

const panelCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  padding: 0,
  borderRadius: 18,
  background: "#fff",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
  background: "#fff",
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
};

const primaryBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

const linkBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  textDecoration: "none",
  color: "#111",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const emptyBox: React.CSSProperties = {
  ...panelCard,
  background: "#fff",
  borderRadius: 16,
  padding: 18,
};
