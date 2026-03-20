// src/app/hr/worklogs/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  code: string | null;
  fullName: string;
  kind: string;
  jobTitle: string | null;
  isActive: boolean;
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
  createdAt: string;
  updatedAt: string;
  employee: EmployeeLite;
  approvedByUserId: string | null;
  approvedByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string | null;
    fullName: string | null;
  } | null;
};

const AREAS: WorkArea[] = ["PLATFORM", "BOOTH", "STORE", "BAR", "MECHANICS", "HR", "ADMIN", "OTHER"];
const STATUSES: WorkLogStatus[] = ["OPEN", "CLOSED", "APPROVED", "CANCELED"];

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

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
};

const errorBox: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const todayStr = new Date().toISOString().slice(0, 10);

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
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

function fmtMinutes(total: number | null) {
  if (total === null || total === undefined) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
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

function areaLabel(area: WorkArea) {
  switch (area) {
    case "PLATFORM":
      return "Plataforma";
    case "BOOTH":
      return "Booth";
    case "STORE":
      return "Tienda";
    case "BAR":
      return "Bar";
    case "MECHANICS":
      return "Mecánica";
    case "HR":
      return "RR. HH.";
    case "ADMIN":
      return "Admin";
    default:
      return "Otra";
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

function statusLabel(status: WorkLogStatus) {
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

function statusStyle(status: WorkLogStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };
  if (status === "OPEN") return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  if (status === "APPROVED") return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  if (status === "CLOSED") return { ...base, borderColor: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" };
  if (status === "CANCELED") return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  return base;
}

export default function HrWorklogsPage() {
  const [rows, setRows] = useState<WorkLogRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [area, setArea] = useState<"" | WorkArea>("");
  const [status, setStatus] = useState<"" | WorkLogStatus>("");
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLogRow | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (employeeId) p.set("employeeId", employeeId);
    if (area) p.set("area", area);
    if (status) p.set("status", status);
    if (from) p.set("from", new Date(`${from}T00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59`).toISOString());
    p.set("take", "200");
    return p.toString();
  }, [employeeId, area, status, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, empRes] = await Promise.all([
        fetch(`/api/hr/worklogs?${query}`, { cache: "no-store" }),
        fetch(`/api/hr/employees?isActive=true`, { cache: "no-store" }),
      ]);

      if (!logsRes.ok) throw new Error(await logsRes.text());
      if (!empRes.ok) throw new Error(await empRes.text());

      const logsJson = await logsRes.json();
      const empJson = await empRes.json();

      setRows(logsJson.rows ?? []);
      setEmployees(empJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando worklogs");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function quickAction(
    id: string,
    action: "check_in_now" | "check_out_now" | "approve" | "cancel" | "reopen"
  ) {
    try {
      setError(null);

      const res = await fetch(`/api/hr/worklogs/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error(await res.text());

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en acción rápida");
    }
  }

  async function bulkApprove(action: "approve_day_closed" | "approve_week_closed") {
    try {
      setError(null);

      const targetDate = from || new Date().toISOString().slice(0, 10);

      const res = await fetch("/api/hr/worklogs/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          date: targetDate,
          employeeId: employeeId || null,
          area: area || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en aprobación masiva");
    }
  }

  const openCount = rows.filter((r) => r.status === "OPEN").length;
  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;
  const closedCount = rows.filter((r) => r.status === "CLOSED").length;
  const workedMinutesTotal = rows.reduce((acc, r) => acc + Number(r.workedMinutes ?? 0), 0);
  const internCount = rows.filter((r) => r.employee.kind === "INTERNAL").length;

  return (
    <div style={pageShell}>
      <div style={{ ...softCard, padding: 16, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 30 }}>Fichajes</div>
          <div style={{ opacity: 0.72, fontSize: 13 }}>Entrada, salida, descansos y horas trabajadas</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/hr" style={ghostBtn}>RR. HH.</Link>
          <button type="button" onClick={() => load()} style={ghostBtn}>Refrescar</button>
          <button type="button" onClick={() => { setEditing(null); setOpen(true); }} style={primaryBtn}>Nuevo fichaje</button>
          <Link href="/hr/worklogs/week" style={ghostBtn}>Vista semanal</Link>
        </div>
      </div>

      <div style={{ ...softCard, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
        <Field label="Trabajador">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        </Field>

        <Field label="Área">
          <select value={area} onChange={(e) => setArea(e.target.value as "" | WorkArea)} style={inputStyle}>
            <option value="">Todas</option>
            {AREAS.map((a) => <option key={a} value={a}>{areaLabel(a)}</option>)}
          </select>
        </Field>

        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | WorkLogStatus)} style={inputStyle}>
            <option value="">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </Field>

        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </Field>

        <button type="button" onClick={() => load()} style={primaryBtn}>Aplicar</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => bulkApprove("approve_day_closed")} style={ghostBtn}>Aprobar jornadas cerradas del día</button>
        <button type="button" onClick={() => bulkApprove("approve_week_closed")} style={ghostBtn}>Aprobar jornadas cerradas de la semana</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MiniKpi title="Abiertas" value={openCount} warn={openCount > 0} />
        <MiniKpi title="Cerradas" value={closedCount} />
        <MiniKpi title="Aprobadas" value={approvedCount} />
        <MiniKpi title="Horas" value={fmtMinutes(workedMinutesTotal)} />
        <MiniKpi title="Prácticas" value={internCount} />
      </div>

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error && rows.length === 0 ? <div style={{ ...softCard, padding: 18 }}>No hay fichajes para los filtros seleccionados.</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => { setEditing(r); setOpen(true); }} style={{ ...softCard, textAlign: "left", padding: 14, cursor: "pointer", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <Link href={`/hr/employees/${r.employee.id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 950, fontSize: 18 }} onClick={(e) => e.stopPropagation()}>
                  {r.employee.fullName}
                </Link>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {employeeKindLabel(r.employee.kind)}
                  {r.employee.jobTitle ? ` · ${r.employee.jobTitle}` : ""}
                  {r.employee.code ? ` · ${r.employee.code}` : ""}
                </div>
              </div>

              <div style={statusStyle(r.status)}>{statusLabel(r.status)}</div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!r.checkInAt ? <QuickActionButton label="Entrada ahora" onClick={async (e) => { e.stopPropagation(); await quickAction(r.id, "check_in_now"); }} /> : null}
              {r.checkInAt && !r.checkOutAt && r.status !== "CANCELED" ? <QuickActionButton label="Salida ahora" onClick={async (e) => { e.stopPropagation(); await quickAction(r.id, "check_out_now"); }} /> : null}
              {r.status === "CLOSED" ? <QuickActionButton label="Aprobar" onClick={async (e) => { e.stopPropagation(); await quickAction(r.id, "approve"); }} primary /> : null}
              {r.status === "APPROVED" || r.status === "CLOSED" ? <QuickActionButton label="Reabrir" onClick={async (e) => { e.stopPropagation(); await quickAction(r.id, "reopen"); }} /> : null}
              {r.status !== "CANCELED" ? <QuickActionButton label="Cancelar" onClick={async (e) => { e.stopPropagation(); await quickAction(r.id, "cancel"); }} danger /> : null}
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Mini label="Fecha" value={fmtDateInput(r.workDate)} />
              <Mini label="Entrada" value={fmtDateTime(r.checkInAt)} />
              <Mini label="Salida" value={fmtDateTime(r.checkOutAt)} />
              <Mini label="Descanso" value={`${r.breakMinutes} min`} />
              <Mini label="Trabajado" value={fmtMinutes(r.workedMinutes)} />
              <Mini label="Área" value={areaLabel(r.area)} />
            </div>

            {r.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Nota: {r.note}</div> : null}
          </button>
        ))}
      </div>

      {open ? <WorklogModal initial={editing} employees={employees} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await load(); }} /> : null}
    </div>
  );
}

function WorklogModal({ initial, employees, onClose, onSaved }: { initial: WorkLogRow | null; employees: EmployeeLite[]; onClose: () => void; onSaved: () => Promise<void>; }) {
  const isEdit = !!initial;
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [workDate, setWorkDate] = useState(fmtDateInput(initial?.workDate ?? null));
  const [checkInAt, setCheckInAt] = useState(fmtDateTimeInput(initial?.checkInAt ?? null));
  const [checkOutAt, setCheckOutAt] = useState(fmtDateTimeInput(initial?.checkOutAt ?? null));
  const [breakMinutes, setBreakMinutes] = useState(String(initial?.breakMinutes ?? 0));
  const [workedMinutes] = useState(initial?.workedMinutes !== null && initial?.workedMinutes !== undefined ? String(initial.workedMinutes) : "");
  const [area, setArea] = useState<WorkArea>(initial?.area ?? "OTHER");
  const [status, setStatus] = useState<WorkLogStatus>(initial?.status ?? "OPEN");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoworkedMinutes = useMemo(() => computeWorkedMinutesUi({ checkInAt, checkOutAt, breakMinutes }), [checkInAt, checkOutAt, breakMinutes]);

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "grid", placeItems: "center", padding: 16, zIndex: 60 }} onClick={() => (busy ? null : onClose())}>
      <div style={{ width: "min(980px, 100%)", background: "#fff", borderRadius: 20, border: "1px solid #dbe4ea", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)", padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{isEdit ? "Editar fichaje" : "Nuevo fichaje"}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {!isEdit ? <Field label="Trabajador"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}><option value="">Selecciona trabajador...</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></Field> : <Field label="Trabajador"><input value={initial?.employee.fullName ?? ""} readOnly style={inputStyle} /></Field>}
          {!isEdit ? <Field label="Fecha"><input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} style={inputStyle} /></Field> : <Field label="Fecha"><input value={fmtDateInput(initial?.workDate ?? null)} readOnly style={inputStyle} /></Field>}
          <Field label="Entrada"><input type="datetime-local" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} style={inputStyle} /></Field>
          <Field label="Salida"><input type="datetime-local" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} style={inputStyle} /></Field>
          <Field label="Descanso (min)"><input value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} style={inputStyle} /></Field>
          <Field label="Trabajado (automático)"><input value={autoworkedMinutes !== null ? `${autoworkedMinutes} min · ${fmtMinutesUi(autoworkedMinutes)}` : workedMinutes ? `${workedMinutes} min` : "Se calcula con entrada, salida y descanso"} readOnly style={{ ...inputStyle, background: "#f9fafb", color: "#374151", fontWeight: 900 }} /></Field>
          <Field label="Área"><select value={area} onChange={(e) => setArea(e.target.value as WorkArea)} style={inputStyle}>{AREAS.map((a) => <option key={a} value={a}>{areaLabel(a)}</option>)}</select></Field>
          <Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value as WorkLogStatus)} style={inputStyle}>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></Field>
          <Field label="Nota" full><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button type="button" onClick={save} disabled={busy} style={primaryBtn}>{busy ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>{label}{children}</label>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div><div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div></div>;
}

function MiniKpi({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return <div style={{ ...softCard, border: warn ? "1px solid #fde68a" : "1px solid #dbe4ea", background: warn ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff", padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div><div style={{ marginTop: 4, fontSize: 24, fontWeight: 950, color: warn ? "#92400e" : "#111" }}>{value}</div></div>;
}

function QuickActionButton({ label, onClick, primary, danger }: { label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; primary?: boolean; danger?: boolean; }) {
  return <button type="button" onClick={onClick} style={{ padding: "8px 10px", borderRadius: 10, border: primary ? "1px solid #111" : danger ? "1px solid #fecaca" : "1px solid #e5e7eb", background: primary ? "#111" : danger ? "#fff1f2" : "#fff", color: primary ? "#fff" : danger ? "#991b1b" : "#111", fontWeight: 900 }}>{label}</button>;
}
