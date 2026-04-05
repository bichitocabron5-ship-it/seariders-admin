"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type DiscountKind = "FIXED" | "PERCENT" | "FINAL_PRICE";
type DiscountScope = "ALL" | "CATEGORY" | "SERVICE" | "OPTION";
type Service = { id: string; code?: string | null; name?: string | null; category?: string | null };
type Option = { id: string; code?: string | null; serviceId: string; durationMinutes: number; paxMax: number; contractedMinutes: number };
type RuleRow = {
  id: string; name: string; code: string | null; isActive: boolean; kind: DiscountKind; value: number; scope: DiscountScope;
  category: string | null; serviceId: string | null; optionId: string | null; requiresCountry?: string | null; excludeCountry?: string | null;
  startTimeMin: number | null; endTimeMin: number | null; validFrom: string; validTo: string | null; daysOfWeek: number[];
};
type RuleDraft = {
  name: string; code: string; isActive: boolean; kind: DiscountKind; value: number; scope: DiscountScope; category: string;
  serviceId: string; optionId: string; requiresCountry: string; excludeCountry: string; startHHMM: string; endHHMM: string; validFrom: string; validTo: string;
};

const inputStyle: CSSProperties = { ...opsStyles.field, padding: 10, borderRadius: 10 };
const sectionStyle: CSSProperties = { ...opsStyles.sectionCard, marginTop: 14, borderRadius: 14, padding: 12, display: "grid", gap: 10 };
const darkBtn: CSSProperties = { ...opsStyles.primaryButton, padding: "10px 12px", fontWeight: 950 };
const lightBtn: CSSProperties = { ...opsStyles.ghostButton, padding: "10px 12px", border: "1px solid #e5e7eb" };
const pageStyle: CSSProperties = { ...opsStyles.pageShell, width: "min(1200px, 100%)", gap: 14, background: "radial-gradient(circle at top left, rgba(59,130,246,.08), transparent 34%), radial-gradient(circle at top right, rgba(14,165,233,.08), transparent 30%)" };
const heroStyle: CSSProperties = { ...opsStyles.heroCard, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)", boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" };
const summaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 };
const summaryCard: CSSProperties = { ...opsStyles.metricCard, borderRadius: 16, padding: 12, background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)" };
const panelStyle: CSSProperties = { ...opsStyles.sectionCard, border: "1px solid #dbe4ea", borderRadius: 18, background: "#fff", boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" };
const fieldLabel: CSSProperties = { display: "grid", gap: 6, fontSize: 13 };
const errorStyle: CSSProperties = { padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900, whiteSpace: "pre-wrap" };

const pad2 = (n: number) => String(n).padStart(2, "0");
const minToHHMM = (m: number | null) => (m == null ? "" : `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
function hhmmToMin(s: string) { const [hhStr = "", mmStr = ""] = (s || "").trim().split(":"); const hh = Number(hhStr); const mm = Number(mmStr); return !s.trim() ? null : (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59 ? null : hh * 60 + mm); }
const fixedValueLabel = (kind: DiscountKind, value: number) => kind === "PERCENT" ? `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}% dto. mensual / servicio` : kind === "FINAL_PRICE" ? `${(Number(value || 0) / 100).toFixed(2)} EUR precio final promo` : `${(Number(value || 0) / 100).toFixed(2)} EUR descuento fijo`;
const optionLabel = (o: Option) => `${o.durationMinutes} min · máx. ${o.paxMax} pax · contratado ${o.contractedMinutes} min`;
const serviceLabel = (s?: Service | null) => !s ? "Servicio desconocido" : (s.category ? `${s.code ?? s.name ?? s.id} · ${s.category}` : (s.code ?? s.name ?? s.id));
const emptyDraft = (): RuleDraft => ({ name: "", code: "", isActive: true, kind: "FIXED", value: 0, scope: "ALL", category: "", serviceId: "", optionId: "", requiresCountry: "", excludeCountry: "", startHHMM: "", endHHMM: "", validFrom: "", validTo: "" });

export default function DiscountsPage() {
  const [rules, setRules] = useState<RuleRow[]>([]), [services, setServices] = useState<Service[]>([]), [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true), [savingId, setSavingId] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null), [draft, setDraft] = useState<RuleDraft | null>(null);
  const [cName, setCName] = useState(""), [cCode, setCCode] = useState(""), [cIsActive, setCIsActive] = useState(true), [cKind, setCKind] = useState<DiscountKind>("FIXED"), [cValue, setCValue] = useState(0);
  const [cValidFrom, setCValidFrom] = useState(() => new Date().toISOString()), [cValidTo, setCValidTo] = useState<string | null>(null), [cScope, setCScope] = useState<DiscountScope>("SERVICE"), [cCategory, setCCategory] = useState("");
  const [cServiceId, setCServiceId] = useState(""), [cOptionId, setCOptionId] = useState(""), [cRequiresCountry, setCRequiresCountry] = useState(""), [cExcludeCountry, setCExcludeCountry] = useState(""), [cStartHHMM, setCStartHHMM] = useState(""), [cEndHHMM, setCEndHHMM] = useState("");
  const [query, setQuery] = useState(""), [activeFilter, setActiveFilter] = useState<"" | "true" | "false">(""), [scopeFilter, setScopeFilter] = useState<"" | DiscountScope>("");

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [rRules, rCatalog] = await Promise.all([fetch("/api/admin/discounts", { cache: "no-store" }), fetch("/api/admin/discounts/catalog", { cache: "no-store" })]);
      if (!rRules.ok) throw new Error(await rRules.text());
      if (!rCatalog.ok) throw new Error(await rCatalog.text());
      const dRules = await rRules.json(), dCatalog = await rCatalog.json();
      setRules(dRules.rules ?? dRules.rows ?? []); setServices(dCatalog.services ?? []); setOptions(dCatalog.options ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando reglas comerciales"); setRules([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => {
    if (cScope !== "OPTION") return void (cOptionId && setCOptionId(""));
    if (!cServiceId) return void (cOptionId && setCOptionId(""));
    if (cOptionId) { const opt = options.find((o) => o.id === cOptionId); if (opt && opt.serviceId !== cServiceId) setCOptionId(""); }
  }, [cOptionId, cScope, cServiceId, options]);

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const optionsByServiceId = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const option of options) { const current = map.get(option.serviceId) ?? []; current.push(option); map.set(option.serviceId, current); }
    for (const [serviceId, current] of map.entries()) map.set(serviceId, current.sort((a, b) => a.durationMinutes - b.durationMinutes || a.paxMax - b.paxMax));
    return map;
  }, [options]);
  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((rule) => {
      if (scopeFilter && rule.scope !== scopeFilter) return false;
      if (activeFilter === "true" && !rule.isActive) return false;
      if (activeFilter === "false" && rule.isActive) return false;
      if (!q) return true;
      const service = rule.serviceId ? serviceById.get(rule.serviceId) : null, option = rule.optionId ? optionById.get(rule.optionId) : null;
      return [rule.name, rule.code ?? "", rule.scope, rule.category ?? "", rule.requiresCountry ?? "", rule.excludeCountry ?? "", service?.name ?? "", service?.code ?? "", service?.category ?? "", option?.code ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [activeFilter, optionById, query, rules, scopeFilter, serviceById]);
  const stats = useMemo(() => ({ total: rules.length, active: rules.filter((r) => r.isActive).length, filtered: filteredRules.length }), [filteredRules.length, rules]);
  const setD = (patch: Partial<RuleDraft>) => setDraft((prev) => ({ ...(prev ?? emptyDraft()), ...patch }));

  function startEdit(rule: RuleRow) {
    setEditId(rule.id);
    setDraft({ name: rule.name ?? "", code: rule.code ?? "", isActive: rule.isActive ?? true, kind: rule.kind, value: rule.value ?? 0, scope: rule.scope, category: rule.category ?? "", serviceId: rule.serviceId ?? "", optionId: rule.optionId ?? "", requiresCountry: rule.requiresCountry ?? "", excludeCountry: rule.excludeCountry ?? "", startHHMM: minToHHMM(rule.startTimeMin), endHHMM: minToHHMM(rule.endTimeMin), validFrom: (rule.validFrom ?? "").slice(0, 10), validTo: (rule.validTo ?? "").slice(0, 10) });
    setError(null);
  }
  const cancelEdit = () => { setEditId(null); setDraft(null); setError(null); };

  useEffect(() => {
    if (!editId || !draft) return;
    if (draft.scope === "ALL") return void ((draft.category || draft.serviceId || draft.optionId) && setD({ category: "", serviceId: "", optionId: "" }));
    if (draft.scope === "CATEGORY") return void ((draft.serviceId || draft.optionId) && setD({ serviceId: "", optionId: "" }));
    if (draft.scope === "SERVICE") return void ((draft.category || draft.optionId) && setD({ category: "", optionId: "" }));
    if (draft.scope === "OPTION") {
      if (draft.category) setD({ category: "" });
      if (!draft.serviceId && draft.optionId) { const opt = options.find((o) => o.id === draft.optionId); if (opt) setD({ serviceId: opt.serviceId }); }
    }
  }, [draft, editId, options]);
  useEffect(() => {
    if (cScope === "OPTION" && cKind !== "FINAL_PRICE") setCKind("FINAL_PRICE");
    if (cScope === "SERVICE" && cKind !== "PERCENT") setCKind("PERCENT");
  }, [cKind, cScope]);
  useEffect(() => {
    if (!draft) return;
    if (draft.scope === "OPTION" && draft.kind !== "FINAL_PRICE") setD({ kind: "FINAL_PRICE" });
    if (draft.scope === "SERVICE" && draft.kind !== "PERCENT") setD({ kind: "PERCENT" });
  }, [draft]);
  useEffect(() => {
    if (!editId || !draft || draft.scope !== "OPTION" || !draft.serviceId || !draft.optionId) return;
    const opt = options.find((o) => o.id === draft.optionId); if (opt && opt.serviceId !== draft.serviceId) setD({ optionId: "" });
  }, [draft, editId, options]);

  async function createRule() {
    setError(null);
    const body: Record<string, unknown> = { name: cName.trim(), code: cCode.trim() || null, isActive: cIsActive, kind: cKind, value: Number(cValue || 0), validFrom: cValidFrom, validTo: cValidTo, scope: cScope, category: cScope === "CATEGORY" ? cCategory.trim() || null : null, serviceId: cScope === "SERVICE" || cScope === "OPTION" ? cServiceId || null : null, optionId: cScope === "OPTION" ? cOptionId || null : null, requiresCountry: cRequiresCountry.trim() ? cRequiresCountry.trim().toUpperCase() : null, excludeCountry: cExcludeCountry.trim() ? cExcludeCountry.trim().toUpperCase() : null, startTimeMin: hhmmToMin(cStartHHMM), endTimeMin: hhmmToMin(cEndHHMM) };
    if (!body.name) return setError("El nombre es obligatorio.");
    if (body.scope === "CATEGORY" && !body.category) return setError("CATEGORY requiere categoría.");
    if ((body.scope === "SERVICE" || body.scope === "OPTION") && !body.serviceId) return setError("Debes seleccionar un servicio.");
    if (body.scope === "OPTION" && !body.optionId) return setError("Debes seleccionar una opción.");
    const response = await fetch("/api/admin/discounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return setError(await response.text());
    setCName(""); setCCode(""); setCValue(0); setCStartHHMM(""); setCEndHHMM(""); await loadAll();
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setSavingId(id); setError(null);
    const body = { name: String(draft.name ?? "").trim(), code: String(draft.code ?? "").trim() || null, isActive: !!draft.isActive, kind: draft.kind, value: Number(draft.value ?? 0), scope: draft.scope, category: draft.scope === "CATEGORY" ? String(draft.category ?? "").trim() || null : null, serviceId: draft.scope === "SERVICE" || draft.scope === "OPTION" ? String(draft.serviceId ?? "").trim() || null : null, optionId: draft.scope === "OPTION" ? String(draft.optionId ?? "").trim() || null : null, requiresCountry: String(draft.requiresCountry ?? "").trim() || null, excludeCountry: String(draft.excludeCountry ?? "").trim() || null, startTimeMin: hhmmToMin(String(draft.startHHMM ?? "")), endTimeMin: hhmmToMin(String(draft.endHHMM ?? "")), validFrom: draft.validFrom ? new Date(`${draft.validFrom}T00:00:00`).toISOString() : undefined, validTo: draft.validTo ? new Date(`${draft.validTo}T00:00:00`).toISOString() : null };
    try {
      const response = await fetch(`/api/admin/discounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      await loadAll(); cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando la regla comercial");
    } finally { setSavingId(null); }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2563eb" }}>Comercial</div>
          <h1 style={{ ...opsStyles.heroTitle, lineHeight: 1, color: "#0f172a" }}>Reglas Comerciales</h1>
          <p style={{ margin: 0, maxWidth: 760, fontSize: 14, lineHeight: 1.5, color: "#475569" }}>Descuento mensual automatico por porcentaje en servicio y promociones por opcion con precio final.</p>
        </div>
        <div style={opsStyles.actionGrid}>
          <Link href="/admin" style={{ ...opsStyles.ghostButton, padding: "10px 12px", border: "1px solid #dbe4ea", color: "#0f172a" }}>Volver a Admin</Link>
          <button type="button" onClick={() => void loadAll()} disabled={loading} style={darkBtn}>{loading ? "Cargando..." : "Refrescar"}</button>
        </div>
      </section>
      <section style={summaryGrid}>{["Reglas", "Activas", "Filtradas"].map((label, i) => <article key={label} style={summaryCard}><div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div><div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#0f172a" }}>{[stats.total, stats.active, stats.filtered][i]}</div></article>)}</section>
      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={sectionStyle}>
        <div style={{ fontWeight: 950 }}>Crear regla comercial</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={fieldLabel}>Nombre<input value={cName} onChange={(e) => setCName(e.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>Codigo promo<input value={cCode} onChange={(e) => setCCode(e.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>Tipo de regla<select value={cKind} onChange={(e) => setCKind(e.target.value as DiscountKind)} style={inputStyle} disabled={cScope === "OPTION" || cScope === "SERVICE"}><option value="FINAL_PRICE">PRECIO FINAL (céntimos)</option><option value="PERCENT">DESCUENTO (%)</option><option value="FIXED">DESCUENTO FIJO (céntimos)</option></select></label>
          <label style={fieldLabel}>Valor comercial<input type="number" value={Number(cValue || 0)} onChange={(e) => setCValue(Number(e.target.value || 0))} min={0} max={cKind === "PERCENT" ? 100 : 10_000_000} step={cKind === "PERCENT" ? 0.1 : 1} style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }} /></label>
          <label style={fieldLabel}>Aplicacion<select value={cScope} onChange={(e) => setCScope(e.target.value as DiscountScope)} style={inputStyle}><option value="ALL">General</option><option value="CATEGORY">Categoria</option><option value="SERVICE">Servicio</option><option value="OPTION">Opcion</option></select></label>
          <label style={fieldLabel}>Servicio<select value={cServiceId} onChange={(e) => setCServiceId(e.target.value)} disabled={cScope !== "SERVICE" && cScope !== "OPTION"} style={inputStyle}><option value="">Selecciona servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{serviceLabel(s)}</option>)}</select></label>
          <label style={fieldLabel}>Opción<select value={cOptionId} onChange={(e) => setCOptionId(e.target.value)} disabled={cScope !== "OPTION" || !cServiceId} style={inputStyle}><option value="">{cServiceId ? "Selecciona opción" : "Selecciona antes el servicio"}</option>{(cServiceId ? optionsByServiceId.get(cServiceId) ?? [] : []).map((o) => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}</select></label>
          <label style={fieldLabel}>Categoría<input value={cCategory} onChange={(e) => setCCategory(e.target.value)} disabled={cScope !== "CATEGORY"} style={inputStyle} /></label>
          <label style={fieldLabel}>País requerido<input value={cRequiresCountry} onChange={(e) => setCRequiresCountry(e.target.value.toUpperCase())} style={inputStyle} /></label>
          <label style={fieldLabel}>País excluido<input value={cExcludeCountry} onChange={(e) => setCExcludeCountry(e.target.value.toUpperCase())} style={inputStyle} /></label>
          <label style={fieldLabel}>Inicio (HH:MM)<input value={cStartHHMM} onChange={(e) => setCStartHHMM(e.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>Fin (HH:MM)<input value={cEndHHMM} onChange={(e) => setCEndHHMM(e.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>Válido desde<input type="date" value={(cValidFrom ?? "").slice(0, 10)} onChange={(e) => setCValidFrom(e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : new Date().toISOString())} style={inputStyle} /></label>
          <label style={fieldLabel}>Válido hasta<input type="date" value={(cValidTo ?? "").slice(0, 10)} onChange={(e) => setCValidTo(e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null)} style={inputStyle} /></label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}><input type="checkbox" checked={cIsActive} onChange={(e) => setCIsActive(e.target.checked)} />Activo</label>
          <button type="button" onClick={() => void createRule()} style={darkBtn}>Crear regla</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 950 }}>Filtros</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={fieldLabel}>Buscar<input value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} /></label>
          <label style={fieldLabel}>Ámbito<select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "" | DiscountScope)} style={inputStyle}><option value="">Todas</option><option value="ALL">General</option><option value="CATEGORY">Categoria</option><option value="SERVICE">Servicio</option><option value="OPTION">Opcion</option></select></label>
          <label style={fieldLabel}>Activo<select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")} style={inputStyle}><option value="">Todas</option><option value="true">Sí</option><option value="false">No</option></select></label>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950 }}>Reglas comerciales</div>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>{filteredRules.length}</div>
        </div>
        <div style={{ padding: 12 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
          {!loading && filteredRules.length === 0 ? <div style={{ opacity: 0.7 }}>No hay reglas.</div> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {filteredRules.map((rule) => {
              const editing = editId === rule.id, service = rule.serviceId ? serviceById.get(rule.serviceId) : null, option = rule.optionId ? optionById.get(rule.optionId) : null;
              const scopeLabel = rule.scope === "ALL" ? "ALL" : rule.scope === "CATEGORY" ? `CATEGORY · ${rule.category ?? "-"}` : rule.scope === "SERVICE" ? `SERVICE · ${serviceLabel(service)}` : `OPTION · ${serviceLabel(service)}${option ? ` · ${optionLabel(option)}` : ""}`;
              const countryLabel = [rule.requiresCountry ? `req:${rule.requiresCountry}` : "", rule.excludeCountry ? `excl:${rule.excludeCountry}` : ""].filter(Boolean).join(" · ");
              const timeLabel = `${minToHHMM(rule.startTimeMin) || "-"} - ${minToHHMM(rule.endTimeMin) || "-"}`;
              return <div key={rule.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
                {!editing ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>{rule.name}</div>
                      <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", fontWeight: 900, fontSize: 12, background: rule.isActive ? "#ecfeff" : "#fafafa" }}>{rule.isActive ? "ACTIVA" : "INACTIVA"}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{rule.code ? `Codigo promo: ${rule.code}` : "Automatica"}</div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{fixedValueLabel(rule.kind, rule.value)}</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Aplicacion: <b>{scopeLabel}</b></div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>País: <b>{countryLabel || "-"}</b> · Horario: <b>{timeLabel}</b></div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Período: <b>{(rule.validFrom ?? "").slice(0, 10) || "-"}</b> · <b>{(rule.validTo ?? "").slice(0, 10) || "sin fin"}</b></div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => startEdit(rule)} style={{ ...lightBtn, border: "1px solid #111" }}>Editar</button></div>
                </> : <>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>Editar regla comercial</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <label style={fieldLabel}>Nombre<input value={draft?.name ?? ""} onChange={(e) => setD({ name: e.target.value })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Codigo promo<input value={draft?.code ?? ""} onChange={(e) => setD({ code: e.target.value })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Aplicacion<select value={draft?.scope ?? "ALL"} onChange={(e) => setD({ scope: e.target.value as DiscountScope })} style={inputStyle}><option value="ALL">General</option><option value="CATEGORY">Categoria</option><option value="SERVICE">Servicio</option><option value="OPTION">Opcion</option></select></label>
                    <label style={fieldLabel}>Tipo de regla<select value={draft?.kind ?? "FIXED"} onChange={(e) => setD({ kind: e.target.value as DiscountKind })} style={inputStyle} disabled={draft?.scope === "OPTION" || draft?.scope === "SERVICE"}><option value="FINAL_PRICE">PRECIO FINAL (céntimos)</option><option value="PERCENT">DESCUENTO (%)</option><option value="FIXED">DESCUENTO FIJO (céntimos)</option></select></label>
                    <label style={fieldLabel}>Valor comercial<input type="number" value={Number(draft?.value ?? 0)} onChange={(e) => setD({ value: Number(e.target.value || 0) })} min={0} max={draft?.kind === "PERCENT" ? 100 : 10_000_000} step={draft?.kind === "PERCENT" ? 0.1 : 1} style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }} /></label>
                    <label style={fieldLabel}>Servicio<select value={draft?.serviceId ?? ""} onChange={(e) => setD({ serviceId: e.target.value })} disabled={draft?.scope !== "SERVICE" && draft?.scope !== "OPTION"} style={inputStyle}><option value="">Selecciona servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{serviceLabel(s)}</option>)}</select></label>
                    <label style={fieldLabel}>Opción<select value={draft?.optionId ?? ""} onChange={(e) => setD({ optionId: e.target.value })} disabled={draft?.scope !== "OPTION" || !draft?.serviceId} style={inputStyle}><option value="">{draft?.serviceId ? "Selecciona opción" : "Selecciona antes el servicio"}</option>{(draft?.serviceId ? optionsByServiceId.get(draft.serviceId) ?? [] : []).map((o) => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}</select></label>
                    <label style={fieldLabel}>Categoría<input value={draft?.category ?? ""} onChange={(e) => setD({ category: e.target.value })} disabled={draft?.scope !== "CATEGORY"} style={inputStyle} /></label>
                    <label style={fieldLabel}>País requerido<input value={draft?.requiresCountry ?? ""} onChange={(e) => setD({ requiresCountry: e.target.value.toUpperCase() })} style={inputStyle} /></label>
                    <label style={fieldLabel}>País excluido<input value={draft?.excludeCountry ?? ""} onChange={(e) => setD({ excludeCountry: e.target.value.toUpperCase() })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Inicio (HH:MM)<input value={draft?.startHHMM ?? ""} onChange={(e) => setD({ startHHMM: e.target.value })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Fin (HH:MM)<input value={draft?.endHHMM ?? ""} onChange={(e) => setD({ endHHMM: e.target.value })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Válido desde<input type="date" value={draft?.validFrom ?? ""} onChange={(e) => setD({ validFrom: e.target.value })} style={inputStyle} /></label>
                    <label style={fieldLabel}>Válido hasta<input type="date" value={draft?.validTo ?? ""} onChange={(e) => setD({ validTo: e.target.value })} style={inputStyle} /></label>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}><input type="checkbox" checked={Boolean(draft?.isActive)} onChange={(e) => setD({ isActive: e.target.checked })} />Activo</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={cancelEdit} disabled={savingId === rule.id} style={lightBtn}>Cancelar</button>
                      <button type="button" onClick={() => void saveEdit(rule.id)} disabled={savingId === rule.id} style={{ ...darkBtn, background: savingId === rule.id ? "#9ca3af" : "#111" }}>{savingId === rule.id ? "Guardando..." : "Guardar"}</button>
                    </div>
                  </div>
                </>}
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
