"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type DiscountKind = "FIXED" | "PERCENT";
type DiscountScope = "ALL" | "CATEGORY" | "SERVICE" | "OPTION";

type Service = { id: string; code?: string | null; name?: string | null; category?: string | null };
type Option = { id: string; code?: string | null; serviceId: string; durationMinutes: number; paxMax: number; contractedMinutes: number };

type RuleRow = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  category: string | null;
  serviceId: string | null;
  optionId: string | null;
  requiresCountry?: string | null;
  excludeCountry?: string | null;
  startTimeMin: number | null;
  endTimeMin: number | null;
  validFrom: string;
  validTo: string | null;
  daysOfWeek: number[];
};

type RuleDraft = {
  name: string;
  code: string;
  isActive: boolean;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  category: string;
  serviceId: string;
  optionId: string;
  requiresCountry: string;
  excludeCountry: string;
  startHHMM: string;
  endHHMM: string;
};

const inputStyle: React.CSSProperties = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" };
const sectionStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 10,
};
const darkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};
const lightBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minToHHMM(m: number | null) {
  if (m == null) return "";
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function hhmmToMin(s: string): number | null {
  const t = (s || "").trim();
  if (!t) return null;
  const [hhStr, mmStr] = t.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function fixedValueLabel(kind: DiscountKind, value: number) {
  if (kind === "PERCENT") return `${value}%`;
  return `${(Number(value || 0) / 100).toFixed(2)} EUR`;
}

function optionLabel(o: Option) {
  return `${o.durationMinutes} min · max ${o.paxMax} pax · contratado ${o.contractedMinutes} min`;
}

function serviceLabel(s?: Service | null) {
  if (!s) return "Servicio desconocido";
  const base = s.code ?? s.name ?? s.id;
  return s.category ? `${base} · ${s.category}` : base;
}

export default function DiscountsPage() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft | null>(null);

  const [cName, setCName] = useState("");
  const [cCode, setCCode] = useState("");
  const [cIsActive, setCIsActive] = useState(true);
  const [cKind, setCKind] = useState<DiscountKind>("FIXED");
  const [cValue, setCValue] = useState<number>(0);
  const [cValidFrom, setCValidFrom] = useState<string>(() => new Date().toISOString());
  const [cValidTo, setCValidTo] = useState<string | null>(null);
  const [cScope, setCScope] = useState<DiscountScope>("SERVICE");
  const [cCategory, setCCategory] = useState("");
  const [cServiceId, setCServiceId] = useState("");
  const [cOptionId, setCOptionId] = useState("");
  const [cRequiresCountry, setCRequiresCountry] = useState("");
  const [cExcludeCountry, setCExcludeCountry] = useState("");
  const [cStartHHMM, setCStartHHMM] = useState("");
  const [cEndHHMM, setCEndHHMM] = useState("");

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [scopeFilter, setScopeFilter] = useState<"" | DiscountScope>("");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [rRules, rCat] = await Promise.all([
        fetch("/api/admin/discounts", { cache: "no-store" }),
        fetch("/api/admin/discounts/catalog", { cache: "no-store" }),
      ]);
      if (!rRules.ok) throw new Error(await rRules.text());
      if (!rCat.ok) throw new Error(await rCat.text());

      const dRules = await rRules.json();
      const dCat = await rCat.json();
      setRules(dRules.rules ?? dRules.rows ?? []);
      setServices(dCat.services ?? []);
      setOptions(dCat.options ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando descuentos");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (cScope !== "OPTION") {
      if (cOptionId) setCOptionId("");
      return;
    }
    if (!cServiceId) {
      if (cOptionId) setCOptionId("");
      return;
    }
    if (cOptionId) {
      const opt = options.find((o) => o.id === cOptionId);
      if (opt && opt.serviceId !== cServiceId) setCOptionId("");
    }
  }, [cScope, cServiceId, cOptionId, options]);

  const serviceById = useMemo(() => {
    const m = new Map<string, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const optionById = useMemo(() => {
    const m = new Map<string, Option>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  const optionsByServiceId = useMemo(() => {
    const m = new Map<string, Option[]>();
    for (const o of options) {
      const arr = m.get(o.serviceId) ?? [];
      arr.push(o);
      m.set(o.serviceId, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.durationMinutes - b.durationMinutes || a.paxMax - b.paxMax);
      m.set(k, arr);
    }
    return m;
  }, [options]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((r) => {
      if (scopeFilter && r.scope !== scopeFilter) return false;
      if (activeFilter === "true" && !r.isActive) return false;
      if (activeFilter === "false" && r.isActive) return false;
      if (!q) return true;

      const svc = r.serviceId ? serviceById.get(r.serviceId) : null;
      const opt = r.optionId ? optionById.get(r.optionId) : null;
      const haystack = [
        r.name,
        r.code ?? "",
        r.scope,
        r.category ?? "",
        r.requiresCountry ?? "",
        r.excludeCountry ?? "",
        svc?.name ?? "",
        svc?.code ?? "",
        svc?.category ?? "",
        opt?.code ?? "",
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [activeFilter, optionById, query, rules, scopeFilter, serviceById]);

  const stats = useMemo(() => {
    return {
      total: rules.length,
      active: rules.filter((rule) => rule.isActive).length,
      filtered: filteredRules.length,
    };
  }, [filteredRules.length, rules]);

  function setD(patch: Partial<RuleDraft>) {
    setDraft((prev) => ({ ...(prev ?? ({} as RuleDraft)), ...patch }));
  }

  function startEdit(r: RuleRow) {
    setEditId(r.id);
    setDraft({
      name: r.name ?? "",
      code: r.code ?? "",
      isActive: r.isActive ?? true,
      kind: r.kind,
      value: r.value ?? 0,
      scope: r.scope,
      category: r.category ?? "",
      serviceId: r.serviceId ?? "",
      optionId: r.optionId ?? "",
      requiresCountry: r.requiresCountry ?? "",
      excludeCountry: r.excludeCountry ?? "",
      startHHMM: minToHHMM(r.startTimeMin),
      endHHMM: minToHHMM(r.endTimeMin),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setDraft(null);
    setError(null);
  }

  useEffect(() => {
    if (!editId || !draft) return;
    if (draft.scope === "ALL") {
      if (draft.category || draft.serviceId || draft.optionId) setD({ category: "", serviceId: "", optionId: "" });
      return;
    }
    if (draft.scope === "CATEGORY") {
      if (draft.serviceId || draft.optionId) setD({ serviceId: "", optionId: "" });
      return;
    }
    if (draft.scope === "SERVICE") {
      if (draft.category || draft.optionId) setD({ category: "", optionId: "" });
      return;
    }
    if (draft.scope === "OPTION") {
      if (draft.category) setD({ category: "" });
      if (!draft.serviceId && draft.optionId) {
        const opt = options.find((o) => o.id === draft.optionId);
        if (opt) setD({ serviceId: opt.serviceId });
      }
    }
  }, [draft, editId, options]);

  useEffect(() => {
    if (!editId || !draft) return;
    if (draft.scope !== "OPTION" || !draft.serviceId || !draft.optionId) return;
    const opt = options.find((o) => o.id === draft.optionId);
    if (opt && opt.serviceId !== draft.serviceId) setD({ optionId: "" });
  }, [draft, editId, options]);

  async function createRule() {
    setError(null);
    const body: Record<string, unknown> = {
      name: cName.trim(),
      code: cCode.trim() || null,
      isActive: Boolean(cIsActive),
      kind: cKind,
      value: Number(cValue || 0),
      validFrom: cValidFrom,
      validTo: cValidTo,
      scope: cScope,
      category: cScope === "CATEGORY" ? cCategory.trim() || null : null,
      serviceId: cScope === "SERVICE" || cScope === "OPTION" ? cServiceId || null : null,
      optionId: cScope === "OPTION" ? cOptionId || null : null,
      requiresCountry: cRequiresCountry.trim() ? cRequiresCountry.trim().toUpperCase() : null,
      excludeCountry: cExcludeCountry.trim() ? cExcludeCountry.trim().toUpperCase() : null,
      startTimeMin: hhmmToMin(cStartHHMM),
      endTimeMin: hhmmToMin(cEndHHMM),
    };

    if (!body.name) return setError("El nombre es obligatorio.");
    if (body.scope === "CATEGORY" && !body.category) return setError("CATEGORY requiere categoria.");
    if ((body.scope === "SERVICE" || body.scope === "OPTION") && !body.serviceId) return setError("Debes seleccionar un servicio.");
    if (body.scope === "OPTION" && !body.optionId) return setError("Debes seleccionar una opcion.");

    const r = await fetch("/api/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return setError(await r.text());

    setCName("");
    setCCode("");
    setCValue(0);
    setCStartHHMM("");
    setCEndHHMM("");
    await loadAll();
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setSavingId(id);
    setError(null);

    const body = {
      name: String(draft.name ?? "").trim(),
      code: String(draft.code ?? "").trim() || null,
      isActive: Boolean(draft.isActive),
      kind: draft.kind,
      value: Number(draft.value ?? 0),
      scope: draft.scope,
      category: draft.scope === "CATEGORY" ? String(draft.category ?? "").trim() || null : null,
      serviceId: draft.scope === "SERVICE" || draft.scope === "OPTION" ? String(draft.serviceId ?? "").trim() || null : null,
      optionId: draft.scope === "OPTION" ? String(draft.optionId ?? "").trim() || null : null,
      requiresCountry: String(draft.requiresCountry ?? "").trim() || null,
      excludeCountry: String(draft.excludeCountry ?? "").trim() || null,
      startTimeMin: hhmmToMin(String(draft.startHHMM ?? "")),
      endTimeMin: hhmmToMin(String(draft.endHHMM ?? "")),
    };

    try {
      const r = await fetch(`/api/admin/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadAll();
      cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando descuento");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Comercial</div>
          <h1 style={titleStyle}>Descuentos</h1>
          <p style={subtitleStyle}>Promociones con importe fijo o porcentaje y ambito configurable.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button type="button" onClick={() => void loadAll()} disabled={loading} style={darkBtn}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Reglas</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Activas</div>
          <div style={summaryValue}>{stats.active}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Filtradas</div>
          <div style={summaryValue}>{stats.filtered}</div>
        </article>
      </section>

      <>
        <div style={{ display: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Admin · Descuentos</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Promociones con importe fijo o porcentaje y ambito configurable.</div>
        <button type="button" onClick={() => void loadAll()} disabled={loading} style={lightBtn}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
        </div>
      </>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={sectionStyle}>
        <div style={{ fontWeight: 950 }}>Crear descuento</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Nombre<input value={cName} onChange={(e) => setCName(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Codigo<input value={cCode} onChange={(e) => setCCode(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Tipo
            <select value={cKind} onChange={(e) => setCKind(e.target.value as DiscountKind)} style={inputStyle}>
              <option value="FIXED">FIJO (centimos)</option><option value="PERCENT">PORCENTAJE (%)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Valor
            <input type="number" value={Number(cValue || 0)} onChange={(e) => setCValue(Number(e.target.value || 0))} min={0} max={cKind === "PERCENT" ? 100 : 10_000_000} step={1} style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Ambito
            <select value={cScope} onChange={(e) => setCScope(e.target.value as DiscountScope)} style={inputStyle}>
              <option value="ALL">ALL</option><option value="CATEGORY">CATEGORY</option><option value="SERVICE">SERVICE</option><option value="OPTION">OPTION</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Servicio
            <select value={cServiceId} onChange={(e) => setCServiceId(e.target.value)} disabled={cScope !== "SERVICE" && cScope !== "OPTION"} style={inputStyle}>
              <option value="">Selecciona servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{serviceLabel(s)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Opcion
            <select value={cOptionId} onChange={(e) => setCOptionId(e.target.value)} disabled={cScope !== "OPTION" || !cServiceId} style={inputStyle}>
              <option value="">{cServiceId ? "Selecciona opcion" : "Selecciona antes el servicio"}</option>
              {(cServiceId ? optionsByServiceId.get(cServiceId) ?? [] : []).map((o) => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Categoria<input value={cCategory} onChange={(e) => setCCategory(e.target.value)} disabled={cScope !== "CATEGORY"} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Pais requerido<input value={cRequiresCountry} onChange={(e) => setCRequiresCountry(e.target.value.toUpperCase())} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Pais excluido<input value={cExcludeCountry} onChange={(e) => setCExcludeCountry(e.target.value.toUpperCase())} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Inicio (HH:MM)<input value={cStartHHMM} onChange={(e) => setCStartHHMM(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Fin (HH:MM)<input value={cEndHHMM} onChange={(e) => setCEndHHMM(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Valido desde
            <input type="date" value={(cValidFrom ?? "").slice(0, 10)} onChange={(e) => setCValidFrom(e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : new Date().toISOString())} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Valido hasta
            <input type="date" value={(cValidTo ?? "").slice(0, 10)} onChange={(e) => setCValidTo(e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null)} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}><input type="checkbox" checked={cIsActive} onChange={(e) => setCIsActive(e.target.checked)} />Activo</label>
          <button type="button" onClick={() => void createRule()} style={darkBtn}>Crear regla</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 950 }}>Filtros</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Buscar<input value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Ambito
            <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "" | DiscountScope)} style={inputStyle}>
              <option value="">Todos</option><option value="ALL">ALL</option><option value="CATEGORY">CATEGORY</option><option value="SERVICE">SERVICE</option><option value="OPTION">OPTION</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Activo
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")} style={inputStyle}>
              <option value="">Todos</option><option value="true">Si</option><option value="false">No</option>
            </select>
          </label>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 950 }}>Reglas de descuento</div>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>{filteredRules.length}</div>
        </div>

        <div style={{ padding: 12 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
          {!loading && filteredRules.length === 0 ? <div style={{ opacity: 0.7 }}>No hay reglas.</div> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {filteredRules.map((r) => {
              const isEditing = editId === r.id;
              const svc = r.serviceId ? serviceById.get(r.serviceId) : null;
              const opt = r.optionId ? optionById.get(r.optionId) : null;
              const scopeLabel =
                r.scope === "ALL"
                  ? "ALL"
                  : r.scope === "CATEGORY"
                    ? `CATEGORY · ${r.category ?? "-"}`
                    : r.scope === "SERVICE"
                      ? `SERVICE · ${serviceLabel(svc)}`
                      : `OPTION · ${serviceLabel(svc)}${opt ? ` · ${optionLabel(opt)}` : ""}`;
              const countryLabel = [r.requiresCountry ? `req:${r.requiresCountry}` : "", r.excludeCountry ? `excl:${r.excludeCountry}` : ""]
                .filter(Boolean)
                .join(" · ");
              const timeLabel = `${minToHHMM(r.startTimeMin) || "-"} - ${minToHHMM(r.endTimeMin) || "-"}`;

              return (
                <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
                  {!isEditing ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                          <div style={{ fontWeight: 950, fontSize: 16 }}>{r.name}</div>
                          <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", fontWeight: 900, fontSize: 12, background: r.isActive ? "#ecfeff" : "#fafafa" }}>
                            {r.isActive ? "ACTIVA" : "INACTIVA"}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>{r.code ? `Codigo: ${r.code}` : "Sin codigo"}</div>
                        </div>
                        <div style={{ fontWeight: 900 }}>{fixedValueLabel(r.kind, r.value)}</div>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.85 }}>Ambito: <b>{scopeLabel}</b></div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>Pais: <b>{countryLabel || "-"}</b> · Horario: <b>{timeLabel}</b></div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button type="button" onClick={() => startEdit(r)} style={{ ...lightBtn, border: "1px solid #111" }}>Editar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>Editar descuento</div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Nombre<input value={draft?.name ?? ""} onChange={(e) => setD({ name: e.target.value })} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Codigo<input value={draft?.code ?? ""} onChange={(e) => setD({ code: e.target.value })} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Ambito
                          <select value={draft?.scope ?? "ALL"} onChange={(e) => setD({ scope: e.target.value as DiscountScope })} style={inputStyle}>
                            <option value="ALL">ALL</option><option value="CATEGORY">CATEGORY</option><option value="SERVICE">SERVICE</option><option value="OPTION">OPTION</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Tipo
                          <select value={draft?.kind ?? "FIXED"} onChange={(e) => setD({ kind: e.target.value as DiscountKind })} style={inputStyle}>
                            <option value="FIXED">FIJO (centimos)</option><option value="PERCENT">PORCENTAJE (%)</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Valor
                          <input type="number" value={Number(draft?.value ?? 0)} onChange={(e) => setD({ value: Number(e.target.value || 0) })} min={0} max={draft?.kind === "PERCENT" ? 100 : 10_000_000} step={1} style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }} />
                        </label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Servicio
                          <select value={draft?.serviceId ?? ""} onChange={(e) => setD({ serviceId: e.target.value })} disabled={draft?.scope !== "SERVICE" && draft?.scope !== "OPTION"} style={inputStyle}>
                            <option value="">Selecciona servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{serviceLabel(s)}</option>)}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Opcion
                          <select value={draft?.optionId ?? ""} onChange={(e) => setD({ optionId: e.target.value })} disabled={draft?.scope !== "OPTION" || !draft?.serviceId} style={inputStyle}>
                            <option value="">{draft?.serviceId ? "Selecciona opcion" : "Selecciona antes el servicio"}</option>
                            {(draft?.serviceId ? optionsByServiceId.get(draft.serviceId) ?? [] : []).map((o) => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Categoria<input value={draft?.category ?? ""} onChange={(e) => setD({ category: e.target.value })} disabled={draft?.scope !== "CATEGORY"} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Pais requerido<input value={draft?.requiresCountry ?? ""} onChange={(e) => setD({ requiresCountry: e.target.value.toUpperCase() })} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Pais excluido<input value={draft?.excludeCountry ?? ""} onChange={(e) => setD({ excludeCountry: e.target.value.toUpperCase() })} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Inicio (HH:MM)<input value={draft?.startHHMM ?? ""} onChange={(e) => setD({ startHHMM: e.target.value })} style={inputStyle} /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Fin (HH:MM)<input value={draft?.endHHMM ?? ""} onChange={(e) => setD({ endHHMM: e.target.value })} style={inputStyle} /></label>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                          <input type="checkbox" checked={Boolean(draft?.isActive)} onChange={(e) => setD({ isActive: e.target.checked })} />Activo
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={cancelEdit} disabled={savingId === r.id} style={lightBtn}>Cancelar</button>
                          <button type="button" onClick={() => void saveEdit(r.id)} disabled={savingId === r.id} style={{ ...darkBtn, background: savingId === r.id ? "#9ca3af" : "#111" }}>
                            {savingId === r.id ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#2563eb",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const errorStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "pre-wrap",
};
