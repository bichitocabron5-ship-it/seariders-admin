"use client";

import { useState } from "react";
import type React from "react";

import type { EmployeeLite, EmployeeRateType, RateRow } from "../types";

export function RateModal({
  initial,
  employees,
  rateTypes,
  rateTypeLabel,
  fmtDateInput,
  onClose,
  onSaved,
  inputStyle,
  ghostBtn,
  primaryBtn,
  errorBox,
}: {
  initial: RateRow | null;
  employees: EmployeeLite[];
  rateTypes: EmployeeRateType[];
  rateTypeLabel: (value: EmployeeRateType) => string;
  fmtDateInput: (iso: string | null) => string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  inputStyle: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  primaryBtn: React.CSSProperties;
  errorBox: React.CSSProperties;
}) {
  const isEdit = !!initial;

  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [rateType, setRateType] = useState<EmployeeRateType>(initial?.rateType ?? "HOURLY");
  const [amountCents, setAmountCents] = useState(String(initial?.amountCents ?? ""));
  const [effectiveFrom, setEffectiveFrom] = useState(fmtDateInput(initial?.effectiveFrom ?? null));
  const [effectiveTo, setEffectiveTo] = useState(fmtDateInput(initial?.effectiveTo ?? null));
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      if (!isEdit && !employeeId) throw new Error("Selecciona un trabajador.");
      if (!effectiveFrom) throw new Error("Fecha desde obligatoria.");
      if (!amountCents.trim()) throw new Error("Importe obligatorio.");

      const selectedEmployee = employees.find((employee) => employee.id === employeeId);
      if (!isEdit && selectedEmployee?.kind === "INTERN") {
        throw new Error("Los trabajadores en prácticas no deben tener tarifa salarial.");
      }

      const body = isEdit
        ? {
            rateType,
            amountCents: Number(amountCents),
            effectiveFrom: new Date(`${effectiveFrom}T00:00`).toISOString(),
            effectiveTo: effectiveTo ? new Date(`${effectiveTo}T00:00`).toISOString() : null,
            note: note.trim() || null,
          }
        : {
            employeeId,
            rateType,
            amountCents: Number(amountCents),
            effectiveFrom: new Date(`${effectiveFrom}T00:00`).toISOString(),
            effectiveTo: effectiveTo ? new Date(`${effectiveTo}T00:00`).toISOString() : null,
            note: note.trim() || null,
          };

      const response = await fetch(isEdit ? `/api/hr/rates/${initial!.id}` : "/api/hr/rates", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(await response.text());

      await onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Error guardando tarifa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar tarifa" : "Nueva tarifa"} onClose={onClose} ghostBtn={ghostBtn}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {!isEdit ? (
          <Field label="Trabajador">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
              <option value="">Selecciona trabajador...</option>
              {employees
                .filter((employee) => employee.kind !== "INTERN")
                .map((employee) => (
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

        <Field label="Tipo tarifa">
          <select value={rateType} onChange={(e) => setRateType(e.target.value as EmployeeRateType)} style={inputStyle}>
            {rateTypes.map((type) => (
              <option key={type} value={type}>
                {rateTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Importe (céntimos)">
          <input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Vigente desde">
          <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Vigente hasta">
          <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Nota" full>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}

      <ModalActions onClose={onClose} onSave={save} busy={busy} ghostBtn={ghostBtn} primaryBtn={primaryBtn} />
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  ghostBtn,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  ghostBtn: React.CSSProperties;
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
  ghostBtn,
  primaryBtn,
}: {
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  ghostBtn: React.CSSProperties;
  primaryBtn: React.CSSProperties;
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
