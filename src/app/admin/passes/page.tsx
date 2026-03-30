"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";

type ServiceDto = { id: string; name: string; category: string | null };
type OptionDto = { id: string; serviceId: string; durationMinutes: number | null; paxMax: number | null; contractedMinutes: number | null };
type PassProductRow = { id: string; code: string; name: string; isActive: boolean; totalMinutes: number; priceCents: number; validDays: number | null; service: { id: string; name: string; category: string | null }; option: { id: string; durationMinutes: number | null } | null };

function eurosFromCents(cents: number) { return (Number(cents || 0) / 100).toFixed(2); }
function centsFromEurosString(v: string) { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : 0; }

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; }) {
  return <label style={{ display: "grid", gap: 6 }}><div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>{label}</div><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...opsStyles.field, width: "100%", padding: 10, borderRadius: 12, background: "#fff" }} /></label>;
}

export default function AdminPassProductsPage() {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [options, setOptions] = useState<OptionDto[]>([]);
  const [rows, setRows] = useState<PassProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [optionId, setOptionId] = useState<string>("");
  const [totalMinutes, setTotalMinutes] = useState("600");
  const [priceEuros, setPriceEuros] = useState("0.00");
  const [validDays, setValidDays] = useState<string>("");

  const isEdit = Boolean(selectedId);
  const filteredOptions = useMemo(() => !serviceId ? [] : options.filter((o) => o.serviceId === serviceId), [options, serviceId]);

  function resetForm() { setSelectedId(null); setCode(""); setName(""); setIsActive(true); setServiceId(""); setOptionId(""); setTotalMinutes("600"); setPriceEuros("0.00"); setValidDays(""); }

  async function loadAll() {
    setErr(null); setLoading(true);
    try {
      const r1 = await fetch("/api/admin/passes/catalog", { cache: "no-store" });
      if (!r1.ok) throw new Error(await r1.text());
      const j1 = await r1.json(); setServices(j1.services ?? []); setOptions(j1.options ?? []);
      const r2 = await fetch("/api/admin/passes/products", { cache: "no-store" });
      if (!r2.ok) throw new Error(await r2.text());
      const j2 = await r2.json(); setRows(j2.products ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando bonos");
    } finally { setLoading(false); }
  }

  useEffect(() => { const timer = setTimeout(() => { void loadAll(); }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!serviceId) { setOptionId(""); return; } if (optionId && !filteredOptions.some((o) => o.id === optionId)) setOptionId(""); }, [serviceId, optionId, filteredOptions]);

  function selectRow(r: PassProductRow) {
    setSelectedId(r.id); setCode(r.code); setName(r.name); setIsActive(Boolean(r.isActive)); setServiceId(r.service?.id ?? ""); setOptionId(r.option?.id ?? ""); setTotalMinutes(String(r.totalMinutes ?? 0)); setPriceEuros(eurosFromCents(r.priceCents ?? 0)); setValidDays(r.validDays == null ? "" : String(r.validDays));
  }

  async function createProduct() {
    setErr(null);
    try {
      const r = await fetch("/api/admin/passes/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, isActive, serviceId, optionId: optionId || null, totalMinutes: Number(totalMinutes), priceCents: centsFromEurosString(priceEuros), validDays: validDays.trim() ? Number(validDays) : null }) });
      if (!r.ok) throw new Error(await r.text());
      await loadAll(); resetForm();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error creando bono"); }
  }

  async function saveProduct() {
    if (!selectedId) return;
    setErr(null);
    try {
      const r = await fetch(`/api/admin/passes/products/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, isActive, serviceId, optionId: optionId || null, totalMinutes: Number(totalMinutes), priceCents: centsFromEurosString(priceEuros), validDays: validDays.trim() ? Number(validDays) : null }) });
      if (!r.ok) throw new Error(await r.text());
      await loadAll();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error guardando bono"); }
  }

  async function toggleActive(r: PassProductRow) {
    setErr(null);
    try {
      const rr = await fetch(`/api/admin/passes/products/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !r.isActive }) });
      if (!rr.ok) throw new Error(await rr.text());
      await loadAll();
      if (selectedId === r.id) setIsActive(!r.isActive);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error cambiando estado"); }
  }

  const canSubmit = code.trim().length >= 3 && name.trim().length >= 3 && !!serviceId && Number(totalMinutes) > 0 && centsFromEurosString(priceEuros) >= 0;

  const pageShell: React.CSSProperties = { ...opsStyles.pageShell, width: "min(1320px, 100%)", display: "grid", gap: 16 };
  const softCard: React.CSSProperties = { ...opsStyles.sectionCard, borderRadius: 22 };
  const ghostBtn: React.CSSProperties = { ...opsStyles.ghostButton, padding: "10px 12px", fontWeight: 800, background: "#fff", color: "#111", textDecoration: "none" };
  const darkBtn: React.CSSProperties = { ...opsStyles.primaryButton, padding: "14px 12px", borderRadius: 14, background: canSubmit ? "#111" : "#e5e7eb", color: canSubmit ? "#fff" : "#111", fontWeight: 900, cursor: canSubmit ? "pointer" : "not-allowed" };

  return (
    <div style={pageShell}>
      <section style={{ ...opsStyles.heroCard, padding: 20, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)", display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0891b2" }}>Admin</div>
            <div style={{ ...opsStyles.heroTitle, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.02 }}>Bonos y pases</div>
            <div style={{ fontSize: 14, color: "#475569" }}>Crear y mantener productos de bonos con servicio, opción, minutos consumibles y caducidad.</div>
          </div>
          <div style={opsStyles.actionGrid}><Link href="/admin" style={ghostBtn}>Volver a Admin</Link><button type="button" onClick={() => void loadAll()} disabled={loading} style={{ ...ghostBtn, opacity: loading ? 0.7 : 1 }}>{loading ? "Cargando..." : "Refrescar"}</button></div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><span style={heroPill}>Productos: {rows.length}</span><span style={heroPill}>Servicios: {services.length}</span><span style={heroPill}>Opciones: {options.length}</span><span style={heroPill}>Modo: {isEdit ? "Edición" : "Alta"}</span></div>
      </section>

      {err ? <div style={errorBox}>{err}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 14, alignItems: "start" }}>
        <section style={{ ...softCard, padding: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div style={{ fontSize: 18, fontWeight: 900 }}>Productos</div><button type="button" onClick={resetForm} style={ghostBtn}>Nuevo</button></div>
          <div style={{ display: "grid", gap: 10 }}>{rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay productos aún.</div> : rows.map((r) => <div key={r.id} style={{ border: selectedId === r.id ? "1px solid #111" : "1px solid #e5edf4", borderRadius: 16, padding: 12, background: selectedId === r.id ? "#fafcff" : "#fff" }}><button type="button" onClick={() => selectRow(r)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}><div style={{ fontWeight: 900 }}>{r.name} {!r.isActive ? <span style={{ fontSize: 12, opacity: 0.7 }}>· INACTIVO</span> : null}</div><div style={{ fontWeight: 900 }}>{eurosFromCents(r.priceCents)} EUR</div></div><div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.4 }}>{r.code} · {r.totalMinutes} min · {r.service?.category ? `${r.service.category} · ` : ""}{r.service?.name}{r.option?.durationMinutes ? ` · opción ${r.option.durationMinutes}m` : ""}{r.validDays ? ` · caduca ${r.validDays} días` : ""}</div></button><div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={() => void toggleActive(r)} style={{ ...ghostBtn, background: r.isActive ? "#fff" : "#111", color: r.isActive ? "#111" : "#fff" }}>{r.isActive ? "Desactivar" : "Activar"}</button></div></div>)}</div>
        </section>

        <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><div style={{ fontSize: 18, fontWeight: 900 }}>{isEdit ? "Editar producto" : "Crear producto"}</div><label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, fontSize: 13 }}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Activo</label></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><Field label="Code" value={code} onChange={setCode} placeholder="PASS_JETSKI_10H" /><Field label="Nombre" value={name} onChange={setName} placeholder="Bono Jetski 10h" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}><label style={{ display: "grid", gap: 6 }}><div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Servicio</div><select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ ...opsStyles.field, width: "100%", padding: 10, borderRadius: 12, background: "#fff" }}><option value="">Selecciona...</option>{services.map((s) => <option key={s.id} value={s.id}>{s.category ? `${s.category} · ` : ""}{s.name}</option>)}</select></label><label style={{ display: "grid", gap: 6 }}><div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>Opción (opcional)</div><select value={optionId} onChange={(e) => setOptionId(e.target.value)} disabled={!serviceId} style={{ ...opsStyles.field, width: "100%", padding: 10, borderRadius: 12, background: "#fff", opacity: !serviceId ? 0.6 : 1 }}><option value="">(sin opción fija)</option>{filteredOptions.map((o) => <option key={o.id} value={o.id}>{o.durationMinutes ? `${o.durationMinutes} min` : "-"}{o.paxMax ? ` · ${o.paxMax} pax` : ""}</option>)}</select></label></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}><Field label="Total minutos" value={totalMinutes} onChange={setTotalMinutes} type="number" placeholder="600" /><Field label="Precio (EUR)" value={priceEuros} onChange={setPriceEuros} placeholder="299.00" /><Field label="Caducidad (días)" value={validDays} onChange={setValidDays} type="number" placeholder="365" /></div>
          <button type="button" onClick={isEdit ? () => void saveProduct() : () => void createProduct()} disabled={!canSubmit} style={darkBtn}>{isEdit ? "Guardar cambios" : "Crear producto"}</button>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Usa codes estables. El precio se fija aquí y el consumo descontará minutos cuando el bono se use en tienda.</div>
        </section>
      </div>
    </div>
  );
}

const heroPill: React.CSSProperties = { ...opsStyles.heroPill, border: "1px solid #bae6fd", background: "rgba(255,255,255,0.88)", color: "#0f766e", fontWeight: 900, fontSize: 12 };
const errorBox: React.CSSProperties = { padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 };

