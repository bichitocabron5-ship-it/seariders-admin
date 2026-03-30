"use client";

import { useMemo, useState } from "react";

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
  fullName: string;
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
  employee: {
    fullName: string;
  };
};

type Props = {
  initial: WorkLogRow | null;
  employees: EmployeeLite[];
  areas: WorkArea[];
  statuses: WorkLogStatus[];
  ghostBtn: React.CSSProperties;
  primaryBtn: React.CSSProperties;
  inputStyle: React.CSSProperties;
  errorBox: React.CSSProperties;
  areaLabel: (area: WorkArea) => string;
  statusLabel: (status: WorkLogStatus) => string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function fmtDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateTimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function computeWorkedMinutesUi(params: {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  breakMinutes?: string | number | null;
}) {
  const { checkInAt, checkOutAt } = params;
  const breakMinutes = Math.max(0, Number(params.breakMinutes ?? 0));

  if (!checkInAt || !checkOutAt) return null;

  const start = new Date(checkInAt);
  const end = new Date(checkOutAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;

  const grossMinutes = Math.floor(diffMs / 60000);
  return Math.max(0, grossMinutes - breakMinutes);
}

function fmtMinutesUi(total: number | null) {
  if (total === null || total === undefined) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>
      {label}
      {children}
    </label>
  );
}

export default function WorklogModal({
  initial,
  employees,
  areas,
  statuses,
  ghostBtn,
  primaryBtn,
  inputStyle,
  errorBox,
  areaLabel,
  statusLabel,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initial;
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [workDate, setWorkDate] = useState(fmtDateInput(initial?.workDate ?? null));
  const [checkInAt, setCheckInAt] = useState(fmtDateTimeInput(initial?.checkInAt ?? null));
  const [checkOutAt, setCheckOutAt] = useState(fmtDateTimeInput(initial?.checkOutAt ?? null));
  const [breakMinutes, setBreakMinutes] = useState(String(initial?.breakMinutes ?? 0));
  const [workedMinutes] = useState(
    initial?.workedMinutes !== null && initial?.workedMinutes !== undefined ? String(initial.workedMinutes) : ""
  );
  const [area, setArea] = useState<WorkArea>(initial?.area ?? "OTHER");
  const [status, setStatus] = useState<WorkLogStatus>(initial?.status ?? "OPEN");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoworkedMinutes = useMemo(
    () => computeWorkedMinutesUi({ checkInAt, checkOutAt, breakMinutes }),
    [checkInAt, checkOutAt, breakMinutes]
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!employeeId) throw new Error("Selecciona un trabajador.");
      if (!workDate) throw new Error("Fecha obligatoria.");

      const body = isEdit
        ? {
            checkInAt: checkInAt ? new Date(checkInAt).toISOString() : null,
            checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null,
            breakMinutes: Number(breakMinutes || 0),
            workedMinutes: autoworkedMinutes !== null ? autoworkedMinutes : workedMinutes.trim() ? Number(workedMinutes) : null,
            area,
            status,
            note: note.trim() || null,
          }
        : {
            employeeId,
            workDate: new Date(`${workDate}T00:00`).toISOString(),
            checkInAt: checkInAt ? new Date(checkInAt).toISOString() : null,
            checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null,
            breakMinutes: Number(breakMinutes || 0),
            workedMinutes: autoworkedMinutes !== null ? autoworkedMinutes : workedMinutes.trim() ? Number(workedMinutes) : null,
            area,
            status,
            note: note.trim() || null,
          };

      const res = await fetch(isEdit ? `/api/hr/worklogs/${initial!.id}` : `/api/hr/worklogs`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando fichaje");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}
      onClick={() => (busy ? null : onClose())}
    >
      <div
        style={{ width: "min(980px, 100%)", background: "#fff", borderRadius: 20, border: "1px solid #dbe4ea", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{isEdit ? "Editar fichaje" : "Nuevo fichaje"}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {!isEdit ? (
            <Field label="Trabajador">
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
                <option value="">Selecciona trabajador...</option>
                {employees.map((employee) => (
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

          {!isEdit ? (
            <Field label="Fecha">
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} style={inputStyle} />
            </Field>
          ) : (
            <Field label="Fecha">
              <input value={fmtDateInput(initial?.workDate ?? null)} readOnly style={inputStyle} />
            </Field>
          )}

          <Field label="Entrada">
            <input type="datetime-local" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Salida">
            <input type="datetime-local" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Descanso (min)">
            <input value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Trabajado (automático)">
            <input
              value={
                autoworkedMinutes !== null
                  ? `${autoworkedMinutes} min · ${fmtMinutesUi(autoworkedMinutes)}`
                  : workedMinutes
                    ? `${workedMinutes} min`
                    : "Se calcula con entrada, salida y descanso"
              }
              readOnly
              style={{ ...inputStyle, background: "#f9fafb", color: "#374151", fontWeight: 900 }}
            />
          </Field>
          <Field label="Área">
            <select value={area} onChange={(e) => setArea(e.target.value as WorkArea)} style={inputStyle}>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {areaLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as WorkLogStatus)} style={inputStyle}>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nota" full>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button type="button" onClick={save} disabled={busy} style={primaryBtn}>
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
