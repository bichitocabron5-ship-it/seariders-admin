"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type PayrollStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELED";

type EmployeeLite = {
  id: string;
  fullName: string;
  kind: string;
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
  employee: {
    fullName: string;
  };
};

type Props = {
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
  inputStyle: CSSProperties;
  ghostBtn: CSSProperties;
  primaryBtn: CSSProperties;
  errorBox: CSSProperties;
};

const PAYROLL_STATUSES: PayrollStatus[] = ["DRAFT", "PENDING", "PAID", "CANCELED"];

export function PayrollEditorModal({
  initial,
  prefill,
  employees,
  onClose,
  onSaved,
  inputStyle,
  ghostBtn,
  primaryBtn,
  errorBox,
}: Props) {
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

      const selectedEmployee = employees.find((employee) => employee.id === employeeId);
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

      const response = await fetch(isEdit ? `/api/hr/payroll/${initial!.id}` : "/api/hr/payroll", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(await response.text());

      await onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error guardando pago");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar pago" : "Nuevo pago"} onClose={onClose} ghostBtn={ghostBtn}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {!isEdit ? (
          <Field label="Trabajador">
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} style={inputStyle}>
              <option value="">Selecciona trabajador...</option>
              {employees.filter((employee) => employee.kind !== "INTERN").map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Trabajador">
            <input value={initial?.employee.fullName ?? ""} readOnly style={inputStyle} />
          </Field>
        )}

        <Field label="Estado">
          <select value={status} onChange={(event) => setStatus(event.target.value as PayrollStatus)} style={inputStyle}>
            {PAYROLL_STATUSES.map((payrollStatus) => (
              <option key={payrollStatus} value={payrollStatus}>
                {payrollStatus}
              </option>
            ))}
          </select>
        </Field>

        {!isEdit ? (
          <>
            <Field label="Periodo desde">
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} style={inputStyle} />
            </Field>

            <Field label="Periodo hasta">
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} style={inputStyle} />
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
          <input value={amountCents} onChange={(event) => setAmountCents(event.target.value)} style={inputStyle} />
        </Field>

        <Field label="Pagado el">
          <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} style={inputStyle} />
        </Field>

        <Field label="Concepto">
          <input value={concept} onChange={(event) => setConcept(event.target.value)} style={inputStyle} />
        </Field>

        <Field label="Nota" full>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}

      <ModalActions onClose={onClose} onSave={save} busy={busy} ghostBtn={ghostBtn} primaryBtn={primaryBtn} />
    </ModalShell>
  );
}

function fmtDateInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ModalShell({
  title,
  children,
  onClose,
  ghostBtn,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  ghostBtn: CSSProperties;
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
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
  ghostBtn,
  primaryBtn,
}: {
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  ghostBtn: CSSProperties;
  primaryBtn: CSSProperties;
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
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>
      {label}
      {children}
    </label>
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
