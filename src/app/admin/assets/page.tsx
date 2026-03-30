"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { AssetRow, AssetStatus, AssetType } from "../types";

const ASSET_TYPES: AssetType[] = ["BOAT", "TOWBOAT", "JETCAR", "PARASAILING", "FLYBOARD", "TOWABLE", "OTHER"];
const ASSET_STATUSES: AssetStatus[] = ["OPERATIONAL", "MAINTENANCE", "DAMAGED", "OUT_OF_SERVICE"];

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1320px, 100%)",
  gap: 16,
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 12,
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
};

const darkBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

export default function AdminAssetsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | AssetType>("");
  const [status, setStatus] = useState<"" | AssetStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);

  const filteredParams = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    return p.toString();
  }, [q, type, status]);

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/assets?${filteredParams}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.assets ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando recursos");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filteredParams]);

  useEffect(() => {
    void load({ showLoading: true });
  }, [load]);

  const operationalCount = rows.filter((r) => r.status === "OPERATIONAL").length;
  const maintenanceCount = rows.filter((r) => r.status === "MAINTENANCE").length;
  const unavailableCount = rows.filter((r) => r.status === "DAMAGED" || r.status === "OUT_OF_SERVICE").length;

  return (
    <div style={pageShell}>
      <section
        style={{
          ...opsStyles.heroCard,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0891b2" }}>
              Admin
            </div>
            <div style={{ ...opsStyles.heroTitle, color: "#0f172a" }}>Recursos náuticos</div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Flota de apoyo, estado operativo y datos técnicos de boats, towboat, jetcar, parasailing, flyboard y towables.
            </div>
          </div>

          <div style={{ ...opsStyles.actionGrid, width: "min(100%, 520px)" }}>
            <Link href="/admin" style={ghostBtn}>
              Volver a admin
            </Link>
            <button type="button" onClick={() => void load({ showLoading: true })} style={ghostBtn}>
              Refrescar
            </button>
            <button type="button" onClick={() => { setEditing(null); setOpen(true); }} style={darkBtn}>
              Nuevo recurso
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPill}>Recursos: {rows.length}</span>
          <span style={heroPill}>Operativos: {operationalCount}</span>
          <span style={heroPill}>Mantenimiento: {maintenanceCount}</span>
          <span style={heroPill}>Fuera de servicio: {unavailableCount}</span>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard title="Recursos" value={rows.length} tone="neutral" />
        <MetricCard title="Operativos" value={operationalCount} tone="success" />
        <MetricCard title="Mantenimiento" value={maintenanceCount} tone="info" />
        <MetricCard title="Bloqueados" value={unavailableCount} tone="warning" />
      </div>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Filtros</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Buscar
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, code, matrícula, bastidor o modelo" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as "" | AssetType)} style={inputStyle}>
              <option value="">Todos</option>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value as "" | AssetStatus)} style={inputStyle}>
              <option value="">Todos</option>
              {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Listado</div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{rows.length} registro(s)</div>
        </div>

        {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
        {error ? <div style={errorBox}>{error}</div> : null}
        {!loading && !error && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay recursos.</div> : null}

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => { setEditing(r); setOpen(true); }} style={{ textAlign: "left", border: "1px solid #e5edf4", borderRadius: 18, padding: 14, background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{r.name}</div>
                    <span style={statusBadge(r.status)}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {r.type}{r.code ? ` · ${r.code}` : ""}{r.plate ? ` · ${r.plate}` : ""}{r.chassisNumber ? ` · Bastidor ${r.chassisNumber}` : ""}{r.maxPax ? ` · Pax max ${r.maxPax}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {r.model ? `Modelo ${r.model}` : "Modelo no informado"}{r.year ? ` · Año ${r.year}` : ""}{r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Actualizado: <b>{fmtDateTime(r.updatedAt)}</b></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {open ? <AssetModal initial={editing} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await load({ showLoading: true }); }} /> : null}
    </div>
  );
}

function AssetModal({ initial, onClose, onSaved }: { initial: AssetRow | null; onClose: () => void; onSaved: () => Promise<void>; }) {
  const isEdit = !!initial;
  const [type, setType] = useState<AssetType>(initial?.type ?? "OTHER");
  const [status, setStatus] = useState<AssetStatus>(initial?.status ?? "OPERATIONAL");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [chassisNumber, setChassisNumber] = useState(initial?.chassisNumber ?? "");
  const [maxPax, setMaxPax] = useState(initial?.maxPax != null ? String(initial.maxPax) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isMotorized, setIsMotorized] = useState(initial?.isMotorized ?? false);
  const [currentHours, setCurrentHours] = useState(initial?.currentHours != null ? String(initial.currentHours) : "");
  const [lastServiceHours, setLastServiceHours] = useState(initial?.lastServiceHours != null ? String(initial.lastServiceHours) : "");
  const [serviceIntervalHours, setServiceIntervalHours] = useState(initial?.serviceIntervalHours != null ? String(initial.serviceIntervalHours) : "85");
  const [serviceWarnHours, setServiceWarnHours] = useState(initial?.serviceWarnHours != null ? String(initial.serviceWarnHours) : "70");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    if (["BOAT", "TOWBOAT", "JETCAR"].includes(type)) setIsMotorized(true);
  }, [type, initial]);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Nombre obligatorio.");
    const yearNum = year.trim() ? Number(year.trim()) : null;
    if (yearNum !== null && (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > 2100)) return setError("Año inválido.");
    const maxPaxNum = maxPax.trim() ? Number(maxPax.trim()) : null;
    if (maxPaxNum !== null && (!Number.isInteger(maxPaxNum) || maxPaxNum < 1 || maxPaxNum > 100)) return setError("Pax máx. inválido.");
    const currentHoursNum = currentHours.trim() ? Number(currentHours.trim()) : null;
    if (currentHours.trim() && (!Number.isFinite(currentHoursNum) || currentHoursNum! < 0)) return setError("Horas actuales inválidas.");
    const lastServiceHoursNum = lastServiceHours.trim() ? Number(lastServiceHours.trim()) : null;
    if (lastServiceHours.trim() && (!Number.isFinite(lastServiceHoursNum) || lastServiceHoursNum! < 0)) return setError("Horas último service inválidas.");
    const serviceIntervalHoursNum = serviceIntervalHours.trim() ? Number(serviceIntervalHours.trim()) : null;
    if (serviceIntervalHours.trim() && (!Number.isFinite(serviceIntervalHoursNum) || serviceIntervalHoursNum! <= 0)) return setError("Intervalo de service inválido.");
    const serviceWarnHoursNum = serviceWarnHours.trim() ? Number(serviceWarnHours.trim()) : null;
    if (serviceWarnHours.trim() && (!Number.isFinite(serviceWarnHoursNum) || serviceWarnHoursNum! < 0)) return setError("Aviso de service inválido.");

    setBusy(true);
    try {
      const body = {
        id: initial?.id?.trim() || null,
        originalCode: initial?.code?.trim() || null,
        type,
        status,
        name: name.trim(),
        code: code.trim() || null,
        model: model.trim() || null,
        year: yearNum,
        plate: plate.trim() || null,
        chassisNumber: chassisNumber.trim() || null,
        maxPax: maxPaxNum,
        note: note.trim() || null,
        isMotorized,
        currentHours: currentHoursNum,
        lastServiceHours: lastServiceHoursNum,
        serviceIntervalHours: serviceIntervalHoursNum ?? undefined,
        serviceWarnHours: serviceWarnHoursNum ?? undefined,
      };
      const hasStableId = Boolean(initial?.id?.trim());
      const targetUrl = isEdit ? (hasStableId ? `/api/admin/assets/${encodeURIComponent(initial!.id)}` : "/api/admin/assets") : "/api/admin/assets";
      const res = await fetch(targetUrl, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando recurso");
    } finally {
      setBusy(false);
    }
  }

  return <div style={overlayStyle} onClick={() => (busy ? null : onClose())}><div style={modalStyle} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}><div style={{ display: "grid", gap: 4 }}><div style={{ fontSize: 24, fontWeight: 950 }}>{isEdit ? "Editar recurso" : "Nuevo recurso"}</div><div style={{ fontSize: 13, color: "#64748b" }}>Datos base, operatividad y horas de mantenimiento.</div></div><button type="button" onClick={() => (busy ? null : onClose())} style={ghostBtn}>Cerrar</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value as AssetType)} style={inputStyle}>{ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field><Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)} style={inputStyle}>{ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field><Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field><Field label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} /></Field><Field label="Modelo"><input value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} /></Field><Field label="Año"><input value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} /></Field><Field label="Matrícula / placa"><input value={plate} onChange={(e) => setPlate(e.target.value)} style={inputStyle} /></Field><Field label="Bastidor"><input value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} style={inputStyle} /></Field><Field label="Pax máx."><input value={maxPax} onChange={(e) => setMaxPax(e.target.value)} style={inputStyle} /></Field><label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={isMotorized} onChange={(e) => setIsMotorized(e.target.checked)} />Recurso motorizado</label><Field label="Horas actuales"><input value={currentHours} onChange={(e) => setCurrentHours(e.target.value)} style={inputStyle} /></Field><Field label="Horas último service"><input value={lastServiceHours} onChange={(e) => setLastServiceHours(e.target.value)} style={inputStyle} /></Field><Field label="Intervalo service"><input value={serviceIntervalHours} onChange={(e) => setServiceIntervalHours(e.target.value)} style={inputStyle} /></Field><Field label="Aviso service"><input value={serviceWarnHours} onChange={(e) => setServiceWarnHours(e.target.value)} style={inputStyle} /></Field><Field label="Nota" full><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></Field></div>{error ? <div style={errorBox}>{error}</div> : null}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}><button type="button" onClick={() => void save()} disabled={busy} style={{ ...darkBtn, background: busy ? "#9ca3af" : "#111", width: "100%" }}>{busy ? "Guardando..." : "Guardar"}</button></div></div></div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean; }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: full ? "1 / -1" : undefined }}>{label}{children}</label>;
}

function MetricCard({ title, value, tone }: { title: string; value: number; tone: "neutral" | "success" | "info" | "warning"; }) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { border: "1px solid #dbe4ea", background: "#fff", color: "#0f172a" },
    success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" },
    info: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" },
    warning: { border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" },
  };
  return <div style={{ ...softCard, ...tones[tone], padding: 14, boxShadow: "none" }}><div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>{title}</div><div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{value}</div></div>;
}

function statusBadge(status: AssetStatus): React.CSSProperties {
  if (status === "OPERATIONAL") return { ...badgeBase, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" };
  if (status === "MAINTENANCE") return { ...badgeBase, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
  return { ...badgeBase, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" };
}

const badgeBase: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 };
const heroPill: React.CSSProperties = { ...opsStyles.heroPill, border: "1px solid #bae6fd", background: "rgba(255,255,255,0.88)", color: "#0f766e" };
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 };
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.38)", display: "grid", placeItems: "center", padding: 16, zIndex: 70 };
const modalStyle: React.CSSProperties = { width: "min(960px, 100%)", borderRadius: 20, border: "1px solid #dbe4ea", background: "#fff", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", padding: 18, display: "grid", gap: 14 };

