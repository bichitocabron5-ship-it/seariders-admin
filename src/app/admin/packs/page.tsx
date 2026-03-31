"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Service = { id: string; name: string; code?: string | null; category: string };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; contractedMinutes?: number; code?: string | null; basePriceCents?: number | null };
type PackItemInput = { serviceId: string; optionId: string | null; quantity: number };
type PackRow = { id: string; code: string; name: string; description?: string | null; isActive: boolean; pricePerPersonCents: number; minPax: number; maxPax?: number | null; validFrom: string; validTo?: string | null; allowedSources: string[]; items?: Array<{ id: string; serviceId: string; optionId: string | null; quantity: number }> };

function normalizeEurosInput(v: string) { return String(v || "").replace(",", "."); }
function centsFromEuros(v: string) { const n = Number(normalizeEurosInput(v)); return Number.isFinite(n) ? Math.round(n * 100) : 0; }
function eurosFromCents(c: number) { return `${(Number(c || 0) / 100).toFixed(2)} EUR`; }
function toISODateStart(dateStr: string) { return new Date(`${dateStr}T00:00:00.000`).toISOString(); }
function yyyyMmDd(iso: string | null | undefined) { return !iso ? "" : String(iso).slice(0, 10); }

const pageShell: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: 24, display: "grid", gap: 16 };
const softCard: React.CSSProperties = { border: "1px solid #dbe4ea", borderRadius: 22, background: "#fff", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" };
const inputStyle: React.CSSProperties = { padding: 10, borderRadius: 12, border: "1px solid #d0d9e4", width: "100%", background: "#fff" };
const primaryBtn: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900 };
const ghostBtn: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", color: "#111", fontWeight: 900, textDecoration: "none" };

export default function AdminPacksPage() {
  const formRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceEuros, setPriceEuros] = useState("0");
  const [minPax, setMinPax] = useState(2);
  const [maxPax, setMaxPax] = useState<string>("");
  const [validFrom, setValidFrom] = useState(() => yyyyMmDd(new Date().toISOString()));
  const [validTo, setValidTo] = useState("");
  const [allowedStore, setAllowedStore] = useState(true);
  const [allowedWeb, setAllowedWeb] = useState(false);
  const [items, setItems] = useState<PackItemInput[]>([]);
  const [itemServiceId, setItemServiceId] = useState<string>("");
  const [itemOptionId, setItemOptionId] = useState<string>("");
  const [itemQty, setItemQty] = useState(1);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);

  const optionsForService = useMemo(() => options.filter((o) => o.serviceId === itemServiceId), [options, itemServiceId]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const c = await fetch("/api/pos/catalog?origin=STORE", { cache: "no-store" });
      if (!c.ok) throw new Error(await c.text());
      const cat = await c.json();
      const svc: Service[] = [...(cat.servicesMain ?? []), ...(cat.servicesExtra ?? [])];
      const opt: Option[] = cat.options ?? [];
      setServices(svc);
      setOptions(opt);
      setItemServiceId((prev) => prev || svc?.[0]?.id || "");

      const p = await fetch("/api/admin/packs", { cache: "no-store" });
      if (!p.ok) throw new Error(await p.text());
      const pj = await p.json();
      setPacks(pj.packs ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando packs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!itemServiceId) {
      setItemOptionId("");
      return;
    }
    if (optionsForService.length === 0) {
      setItemOptionId("");
      return;
    }
    if (!itemOptionId || !optionsForService.some((o) => o.id === itemOptionId)) {
      setItemOptionId(optionsForService[0].id);
    }
  }, [itemServiceId, itemOptionId, optionsForService]);

  async function addItem() {
    if (!itemServiceId) return;
    if (!itemOptionId) {
      setError("Selecciona una opción válida para el ítem del pack.");
      return;
    }
    const payload = { serviceId: itemServiceId, optionId: itemOptionId, quantity: Math.max(1, Number(itemQty || 1)), pax: minPax };
    if (editingPackId) {
      try {
        const r = await fetch(`/api/admin/packs/${editingPackId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error(await r.text());
        await load();
        return;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error añadiendo ítem");
        return;
      }
    }
    setItems((prev) => [...prev, { serviceId: payload.serviceId, optionId: payload.optionId, quantity: payload.quantity }]);
  }

  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  async function createPack() {
    setError(null);
    if (items.length === 0) {
      setError("Anade al menos un item al pack.");
      return;
    }
    if (items.some((it) => !it.optionId)) {
      setError("Todos los items del pack deben tener una opcion seleccionada.");
      return;
    }
    const allowedSources: string[] = []; if (allowedStore) allowedSources.push("STORE"); if (allowedWeb) allowedSources.push("WEB");
    try {
      const r = await fetch("/api/admin/packs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() || null, name: name.trim(), description: description.trim() ? description.trim() : null, isActive: true, pricePerPersonCents: centsFromEuros(priceEuros), minPax: Number(minPax), maxPax: maxPax.trim() ? Number(maxPax) : null, validFrom: validFrom ? toISODateStart(validFrom) : new Date().toISOString(), validTo: validTo ? toISODateStart(validTo) : null, allowedSources, items }) });
      if (!r.ok) throw new Error(await r.text());
      resetForm(); await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error creando pack"); }
  }

  async function savePack() {
    if (!editingPackId) return;
    setError(null);
    const allowedSources: string[] = []; if (allowedStore) allowedSources.push("STORE"); if (allowedWeb) allowedSources.push("WEB");
    try {
      const r = await fetch(`/api/admin/packs/${editingPackId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: description.trim() ? description.trim() : null, isActive: true, pricePerPersonCents: centsFromEuros(priceEuros), minPax: Number(minPax), maxPax: maxPax.trim() ? Number(maxPax) : null, validFrom: validFrom ? toISODateStart(validFrom) : undefined, validTo: validTo ? toISODateStart(validTo) : null, allowedSources }) });
      if (!r.ok) throw new Error(await r.text());
      resetForm(); await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error guardando pack"); }
  }

  async function deletePack(id: string) {
    setError(null); if (!confirm("Eliminar pack?")) return;
    try { const r = await fetch(`/api/admin/packs/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(await r.text()); await load(); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error borrando pack"); }
  }

  function resetForm() {
    setEditingPackId(null); setCode(""); setName(""); setDescription(""); setPriceEuros("0"); setMinPax(2); setMaxPax(""); setValidFrom(yyyyMmDd(new Date().toISOString())); setValidTo(""); setAllowedStore(true); setAllowedWeb(false); setItems([]); setItemOptionId("");
  }

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  return (
    <div style={pageShell}>
      <section style={{ ...softCard, padding: 20, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#4f46e5" }}>Admin</div>
            <div style={{ fontWeight: 950, fontSize: 34, lineHeight: 1.02 }}>Packs comerciales</div>
            <div style={{ fontSize: 14, color: "#475569" }}>Configuración de packs, ítems incluidos, fuentes permitidas y vigencias comerciales.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link href="/admin" style={ghostBtn}>Volver a admin</Link><button type="button" onClick={() => void load()} style={ghostBtn}>Refrescar</button></div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><span style={heroPill}>Packs: {packs.length}</span><span style={heroPill}>Servicios: {services.length}</span><span style={heroPill}>Opciones: {options.length}</span><span style={heroPill}>Modo: {editingPackId ? "Edición" : "Alta"}</span></div>
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <section ref={formRef} style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontWeight: 950, fontSize: 20 }}>{editingPackId ? "Editar pack" : "Crear pack"}</div>{editingPackId ? <span style={modeBadge}>Modo edición</span> : null}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PACK_JETSKI_FAMILY" style={inputStyle} disabled={Boolean(editingPackId)} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" style={inputStyle} /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" style={inputStyle} /><input value={priceEuros} onChange={(e) => setPriceEuros(e.target.value)} placeholder="EUR / persona" style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}><input type="number" min={1} value={minPax} onChange={(e) => setMinPax(Number(e.target.value || 1))} style={inputStyle} placeholder="Min pax" /><input type="number" min={1} value={maxPax} onChange={(e) => setMaxPax(e.target.value)} style={inputStyle} placeholder="Max pax (opcional)" /><label style={{ display: "grid", gap: 6, fontSize: 13 }}>Desde<input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} style={inputStyle} /></label><label style={{ display: "grid", gap: 6, fontSize: 13 }}>Hasta<input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={inputStyle} /></label></div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={allowedStore} onChange={(e) => setAllowedStore(e.target.checked)} />STORE</label><label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={allowedWeb} onChange={(e) => setAllowedWeb(e.target.checked)} />WEB</label><button type="button" onClick={editingPackId ? () => void savePack() : () => void createPack()} style={primaryBtn}>{editingPackId ? "Guardar cambios" : "Crear pack"}</button>{editingPackId ? <button type="button" onClick={resetForm} style={ghostBtn}>Cancelar</button> : null}</div>
        <div style={{ border: "1px dashed #dbe4ea", borderRadius: 16, background: "#fcfcff", padding: 14, display: "grid", gap: 10 }}><div style={{ fontWeight: 900 }}>Ítems del pack</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}><select value={itemServiceId} onChange={(e) => setItemServiceId(e.target.value)} style={inputStyle}>{services.map((s) => <option key={s.id} value={s.id}>{s.category ? `${s.category} · ` : ""}{s.name}</option>)}</select><select value={itemOptionId} onChange={(e) => setItemOptionId(e.target.value)} style={inputStyle} disabled={optionsForService.length === 0}><option value="">{optionsForService.length === 0 ? "Sin opciones disponibles" : "Selecciona una opción"}</option>{optionsForService.map((o) => <option key={o.id} value={o.id}>{o.durationMinutes} min · max {o.paxMax} pax</option>)}</select><input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value || 1))} style={inputStyle} /><button type="button" onClick={() => void addItem()} style={ghostBtn} disabled={!itemServiceId || !itemOptionId}>Añadir ítem</button></div>{items.length > 0 ? <div style={{ display: "grid", gap: 8 }}>{items.map((it, idx) => { const svc = serviceById.get(it.serviceId); const opt = it.optionId ? optionById.get(it.optionId) : null; return <div key={`${it.serviceId}-${it.optionId ?? "none"}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", border: "1px solid #e5edf4", borderRadius: 14, padding: 12, background: "#fff" }}><div style={{ fontSize: 13 }}><b>{svc?.name ?? it.serviceId}</b>{opt ? ` · ${opt.durationMinutes} min · max ${opt.paxMax}` : " · opción pendiente"}{` · qty ${it.quantity}`}</div><button type="button" onClick={() => removeItem(idx)} style={ghostBtn}>Quitar</button></div>; })}</div> : <div style={{ fontSize: 12, opacity: 0.7 }}>Aún no hay ítems en preparación.</div>}</div>
      </section>

      <section style={{ ...softCard, overflow: "hidden" }}><div style={{ padding: "12px 16px", borderBottom: "1px solid #e5edf4", fontWeight: 950 }}>Packs existentes</div>{loading ? <div style={{ padding: 16, opacity: 0.7 }}>Cargando...</div> : packs.length === 0 ? <div style={{ padding: 16, opacity: 0.7 }}>Sin packs.</div> : <div style={{ display: "grid" }}>{packs.map((p) => <div key={p.id} style={{ borderTop: "1px solid #eef2f7", padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div style={{ display: "grid", gap: 6 }}><div style={{ fontWeight: 900, fontSize: 18 }}>{p.code} · {p.name}</div><div style={{ fontSize: 13, color: "#475569" }}>{eurosFromCents(p.pricePerPersonCents)} / persona · min {p.minPax}{p.maxPax ? ` · max ${p.maxPax}` : ""}{` · ${p.allowedSources?.join(", ") || "-"}`}{` · ${p.isActive ? "Activo" : "Inactivo"}`}</div>{p.description ? <div style={{ fontSize: 13 }}>{p.description}</div> : null}<div style={{ fontSize: 13 }}><b>Incluye:</b> {!p.items?.length ? "Sin items" : p.items.map((it) => { const svc = serviceById.get(it.serviceId); const opt = it.optionId ? optionById.get(it.optionId) : null; return `${svc?.name ?? it.serviceId}${opt ? ` (${opt.durationMinutes} min)` : ""} x${it.quantity ?? 1}`; }).join(" · ")}</div></div><div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}><button type="button" onClick={() => { setEditingPackId(p.id); setCode(p.code ?? ""); setName(p.name ?? ""); setDescription(p.description ?? ""); setPriceEuros(String((p.pricePerPersonCents ?? 0) / 100)); setMinPax(p.minPax ?? 1); setMaxPax(p.maxPax ? String(p.maxPax) : ""); setValidFrom(yyyyMmDd(p.validFrom)); setValidTo(p.validTo ? yyyyMmDd(p.validTo) : ""); setAllowedStore((p.allowedSources ?? []).includes("STORE")); setAllowedWeb((p.allowedSources ?? []).includes("WEB")); setItems((p.items ?? []).map((it) => ({ serviceId: it.serviceId, optionId: it.optionId, quantity: it.quantity ?? 1 }))); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={ghostBtn}>Editar</button><button type="button" onClick={() => void deletePack(p.id)} style={ghostBtn}>Borrar</button></div></div></div>)}</div>}</section>
    </div>
  );
}

const heroPill: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.88)", color: "#3730a3", fontWeight: 900, fontSize: 12 };
const modeBadge: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 900, fontSize: 12 };
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 };
