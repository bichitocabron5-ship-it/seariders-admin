"use client";

import type { CSSProperties, ReactNode } from "react";

type PayrollCalculationResponse = {
  ok: true;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    kind: string;
    jobTitle: string | null;
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
    internshipHoursRemaining: number | null;
  } | null;
  rate: {
    rateType: string;
    amountCents: number;
  } | null;
  calculation: {
    supported: boolean;
    suggestedAmountEur: string;
    calculationBase?: string;
    message: string | null;
  };
};

type EmployeeLite = {
  id: string;
  fullName: string;
};

type Props = {
  open: boolean;
  employees: EmployeeLite[];
  calcEmployeeId: string;
  calcPeriodStart: string;
  calcPeriodEnd: string;
  calcBusy: boolean;
  calcError: string | null;
  calcResult: PayrollCalculationResponse | null;
  onClose: () => void;
  onEmployeeChange: (value: string) => void;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onRunCalculation: () => void;
  onUseInNewPayroll: () => void;
  inputStyle: CSSProperties;
  ghostBtn: CSSProperties;
  primaryBtn: CSSProperties;
  errorBox: CSSProperties;
};

export function PayrollCalculationModal({
  open,
  employees,
  calcEmployeeId,
  calcPeriodStart,
  calcPeriodEnd,
  calcBusy,
  calcError,
  calcResult,
  onClose,
  onEmployeeChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onRunCalculation,
  onUseInNewPayroll,
  inputStyle,
  ghostBtn,
  primaryBtn,
  errorBox,
}: Props) {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={() => (calcBusy ? null : onClose())}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Cálculo asistido de pago</div>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cerrar
          </button>
        </div>

        <div style={filtersStyle}>
          <Field label="Trabajador">
            <select value={calcEmployeeId} onChange={(e) => onEmployeeChange(e.target.value)} style={inputStyle}>
              <option value="">Selecciona trabajador...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Periodo desde">
            <input type="date" value={calcPeriodStart} onChange={(e) => onPeriodStartChange(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Periodo hasta">
            <input type="date" value={calcPeriodEnd} onChange={(e) => onPeriodEndChange(e.target.value)} style={inputStyle} />
          </Field>

          <button type="button" onClick={onRunCalculation} disabled={calcBusy} style={primaryBtn}>
            {calcBusy ? "Calculando..." : "Calcular"}
          </button>
        </div>

        {calcError ? <div style={{ ...errorBox, marginTop: 12 }}>{calcError}</div> : null}

        {calcResult ? (
          <div style={resultShellStyle}>
            <div style={resultCardStyle}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{calcResult.employee.fullName}</div>

              <div style={{ fontSize: 13, opacity: 0.85 }}>
                {calcResult.employee.kind}
                {calcResult.employee.jobTitle ? ` · ${calcResult.employee.jobTitle}` : ""}
                {calcResult.employee.code ? ` · ${calcResult.employee.code}` : ""}
              </div>

              <div style={summaryGridStyle}>
                <Mini label="Horas aprobadas" value={calcResult.summary.workedHours.toFixed(2)} />
                <Mini label="Minutos aprobados" value={String(calcResult.summary.workedMinutes)} />
                <Mini label="Días aprobados" value={String(calcResult.summary.workedDays)} />
                <Mini label="Turnos aprobados" value={String(calcResult.summary.workedShifts)} />
                <Mini label="Registros aprobados" value={String(calcResult.summary.approvedLogsCount)} />
              </div>

              <div style={approvedNoticeStyle}>
                El cálculo usa solo jornadas en estado APPROVED. Los registros OPEN, CLOSED o CANCELED no entran en payroll.
              </div>

              {calcResult.rate ? (
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Tarifa: <b>{calcResult.rate.rateType}</b> · {(calcResult.rate.amountCents / 100).toFixed(2)} €
                </div>
              ) : null}

              {calcResult.internship ? (
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Bolsa de prácticas: total <b>{calcResult.internship.internshipHoursTotal ?? "—"} h</b>
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
              <button type="button" onClick={onClose} style={ghostBtn}>
                Cerrar
              </button>
              <button
                type="button"
                onClick={onUseInNewPayroll}
                disabled={!!calcResult.internship?.isIntern}
                style={{
                  ...primaryBtn,
                  background: calcResult.internship?.isIntern ? "#9ca3af" : "#111",
                  borderColor: calcResult.internship?.isIntern ? "#9ca3af" : "#111",
                  cursor: calcResult.internship?.isIntern ? "not-allowed" : "pointer",
                }}
              >
                Usar en nuevo pago
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
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

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.3)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 60,
};

const modalStyle: CSSProperties = {
  width: "min(980px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 14,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
};

const filtersStyle: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr auto",
  gap: 10,
  alignItems: "end",
};

const resultShellStyle: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
};

const resultCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 8,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const approvedNoticeStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 900,
};
