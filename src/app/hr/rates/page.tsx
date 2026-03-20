// src/app/hr/rates/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EmployeeRateType = "HOURLY" | "DAILY" | "MONTHLY" | "PER_SHIFT";

type EmployeeLite = {
  id: string;
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
};

type RateRow = {
  id: string;
  employeeId: string;
  rateType: EmployeeRateType;
  amountCents: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt: string;
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

const RATE_TYPES: EmployeeRateType[] = ["HOURLY", "DAILY", "MONTHLY", "PER_SHIFT"];

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

function rateTypeLabel(t: EmployeeRateType) {
  if (t === "HOURLY") return "Por hora";
  if (t === "DAILY") return "Por día";
  if (t === "MONTHLY") return "Mensual";
  return "Por turno";
}

export default function HrRatesPage() {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [rateType, setRateType] = useState<"" | EmployeeRateType>("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateRow | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (employeeId) p.set("employeeId", employeeId);
    if (rateType) p.set("rateType", rateType);
    return p.toString();
  }, [employeeId, rateType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ratesRes, empRes] = await Promise.all([
        fetch(`/api/hr/rates?${query}`, { cache: "no-store" }),
        fetch(`/api/hr/employees?isActive=true`, { cache: "no-store" }),
      ]);

      if (!ratesRes.ok) throw new Error(await ratesRes.text());
      if (!empRes.ok) throw new Error(await empRes.text());

      const ratesJson = await ratesRes.json();
      const empJson = await empRes.json();

      setRows(ratesJson.rows ?? []);
      setEmployees(empJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando tarifas");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const billableEmployees = useMemo(
    () => employees.filter((e) => e.kind !== "INTERN"),
    [employees]
  );

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 30 }}>Tarifas</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>
            Tarifas por trabajador y vigencia
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/hr"
            style={linkBtn}
          >
            ← RRHH
          </a>

          <button type="button" onClick={() => load()} style={ghostBtn}>
            Refrescar
          </button>

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            style={primaryBtn}
          >
            Nueva tarifa
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
          gridTemplateColumns: "2fr 1fr auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <Field label="Trabajador">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {billableEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo tarifa">
          <select value={rateType} onChange={(e) => setRateType(e.target.value as "" | EmployeeRateType)} style={inputStyle}>
            <option value="">Todas</option>
            {RATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {rateTypeLabel(t)}
              </option>
            ))}
          </select>
        </Field>

        <button type="button" onClick={() => load()} style={primaryBtn}>
          Aplicar
        </button>
      </div>

      {loading ? <div>Cargando…</div> : null}

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={emptyBox}>No hay tarifas para los filtros seleccionados.</div>
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

              <div style={{ fontWeight: 950, fontSize: 18 }}>{eur(r.amountCents)}</div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <Mini label="Tipo" value={rateTypeLabel(r.rateType)} />
              <Mini label="Vigente desde" value={fmtDate(r.effectiveFrom)} />
              <Mini label="Hasta" value={fmtDate(r.effectiveTo)} />
              <Mini label="Creado" value={fmtDate(r.createdAt)} />
            </div>

            {r.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Nota: {r.note}</div> : null}
          </button>
        ))}
      </div>

      {open ? (
        <RateModal
          initial={editing}
          employees={employees}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function RateModal({
  initial,
  employees,
  onClose,
  onSaved,
}: {
  initial: RateRow | null;
  employees: EmployeeLite[];
  onClose: () => void;
  onSaved: () => Promise<void>;
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

      const selectedEmployee = employees.find((e) => e.id === employeeId);
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

      const res = await fetch(isEdit ? `/api/hr/rates/${initial!.id}` : `/api/hr/rates`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando tarifa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar tarifa" : "Nueva tarifa"} onClose={onClose}>
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

        <Field label="Tipo tarifa">
          <select value={rateType} onChange={(e) => setRateType(e.target.value as EmployeeRateType)} style={inputStyle}>
            {RATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {rateTypeLabel(t)}
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