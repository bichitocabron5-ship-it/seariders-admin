// src/app/mechanics/parts/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { PartRow } from "./_components/types";
import { PART_CATEGORIES, normalizePartCategory } from "./_components/categories";
import PartModal from "./_components/PartModal";
import PurchasePartModal from "./_components/PurchasePartModal";
import ConsumePartModal from "./_components/ConsumePartModal";
import AdjustPartModal from "./_components/AdjustPartModal";
import PartHistoryModal from "./_components/PartHistoryModal";

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1440px, 100%)",
  display: "grid",
  gap: 18,
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
};

const inputStyle = { ...opsStyles.field, padding: 10, borderRadius: 12 };
const ghostBtn = {
  ...opsStyles.ghostButton,
  padding: "8px 10px",
  borderRadius: 10,
  fontWeight: 900,
};
const primaryBtn = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 950,
};

function eur(cents: number | null) {
  if (cents === null || cents === undefined) return "-";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

export default function MechanicsPartsPage() {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PartRow | null>(null);
  const [purchasePart, setPurchasePart] = useState<PartRow | null>(null);
  const [consumePart, setConsumePart] = useState<PartRow | null>(null);
  const [adjustPart, setAdjustPart] = useState<PartRow | null>(null);
  const [historyPart, setHistoryPart] = useState<PartRow | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (onlyLowStock) p.set("only", "low_stock");
    return p.toString();
  }, [q, onlyLowStock]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mechanics/parts?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (categoryFilter === "ALL") return rows;
    return rows.filter((row) => normalizePartCategory(row.category) === categoryFilter);
  }, [categoryFilter, rows]);

  const orderedRows = [...filteredRows].sort((a, b) => {
    const aLow = Number(a.stockQty) <= Number(a.minStockQty) ? 0 : 1;
    const bLow = Number(b.stockQty) <= Number(b.minStockQty) ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;

    const categoryCompare = normalizePartCategory(a.category).localeCompare(normalizePartCategory(b.category), "es");
    if (categoryCompare !== 0) return categoryCompare;

    return a.name.localeCompare(b.name, "es");
  });

  const lowStockRows = filteredRows.filter((r) => Number(r.stockQty) <= Number(r.minStockQty));
  const zeroStockRows = filteredRows.filter((r) => Number(r.stockQty) === 0);

  const categorySections = useMemo(() => {
    const groups = new Map<string, PartRow[]>();
    for (const row of orderedRows) {
      const key = normalizePartCategory(row.category);
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    }

    const legacyCategories = Array.from(groups.keys()).filter(
      (category) => !PART_CATEGORIES.includes(category as (typeof PART_CATEGORIES)[number]) && category !== "Sin categoría"
    );

    const preferredOrder = [...PART_CATEGORIES, ...legacyCategories.sort((a, b) => a.localeCompare(b, "es")), "Sin categoría"];
    return preferredOrder
      .map((category) => ({ category, rows: groups.get(category) ?? [] }))
      .filter((section) => section.rows.length > 0);
  }, [orderedRows]);

  return (
    <div style={pageShell}>
      <div
        style={{
          ...opsStyles.heroCard,
          padding: 16,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
          display: "grid",
          gap: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0f766e" }}>Mechanics</div>
          <div style={{ ...opsStyles.heroTitle, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.02 }}>Recambios</div>
          <div style={{ opacity: 0.76, fontSize: 14 }}>Inventario, stock, compras pendientes y consumo en mantenimiento.</div>
        </div>

        <div style={opsStyles.actionGrid}>
          <button onClick={() => load()} style={ghostBtn}>Refrescar</button>
          <button onClick={() => { setEditing(null); setOpen(true); }} style={primaryBtn}>Nuevo recambio</button>
        </div>
      </div>

      <div style={{ ...softCard, padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar recambio, SKU, marca o proveedor..."
          style={{ ...inputStyle, width: 360 }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle, minWidth: 280 }}>
          <option value="ALL">Todas las categorías</option>
          {PART_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
          <option value="Sin categoría">Sin categoría</option>
        </select>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={onlyLowStock} onChange={(e) => setOnlyLowStock(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ ...opsStyles.metricCard, border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>Stock bajo</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#78350f" }}>{lowStockRows.length}</div>
        </div>
        <div style={{ ...opsStyles.metricCard, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>Sin stock</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#7f1d1d" }}>{zeroStockRows.length}</div>
        </div>
        <div style={{ ...opsStyles.metricCard, border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Total recambios</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>{filteredRows.length}</div>
        </div>
      </div>

      {lowStockRows.length > 0 ? (
        <div style={{ ...softCard, border: "1px solid #fde68a", background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)", padding: 14, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 950, color: "#92400e" }}>Compras pendientes</div>
          <div style={{ display: "grid", gap: 6 }}>
            {lowStockRows.sort((a, b) => Number(a.stockQty) - Number(b.stockQty)).map((p) => (
              <div key={p.id} style={{ fontSize: 13 }}>
                <b>{p.name}</b>
                {p.sku ? ` · ${p.sku}` : ""}
                {p.category ? ` · ${p.category}` : ""}
                {p.supplierName ? ` · proveedor: ${p.supplierName}` : ""}
                {` · stock `}
                <b>{p.stockQty}</b>
                {` / mínimo `}
                <b>{p.minStockQty}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}
      {error ? <div style={{ color: "#991b1b", fontWeight: 900 }}>{error}</div> : null}

      {!loading && !error && filteredRows.length === 0 ? (
        <div style={{ ...softCard, padding: 18, color: "#374151", fontSize: 14 }}>
          No hay recambios para el filtro actual. Crea uno nuevo o cambia la categoría.
        </div>
      ) : null}

      {categorySections.map((section) => (
        <section key={section.category} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>{section.category}</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>{section.rows.length} recambio(s)</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {section.rows.map((p) => {
              const low = Number(p.stockQty) <= Number(p.minStockQty);
              return (
                <div key={p.id} style={{ ...softCard, border: low ? "1px solid #fde68a" : "1px solid #dbe4ea", background: low ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <Link href={`/mechanics/parts/${p.id}`} style={{ textDecoration: "none", color: "#111", fontWeight: 950, fontSize: 18 }}>
                        {p.name}
                      </Link>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {p.sku ? `SKU ${p.sku}` : "Sin SKU"}
                        {p.unit ? ` · ${p.unit}` : ""}
                      </div>
                    </div>
                    <button type="button" onClick={() => { setEditing(p); setOpen(true); }} style={ghostBtn}>Editar</button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Metric label="Stock" value={p.stockQty} />
                    <Metric label="Mínimo" value={p.minStockQty} />
                    <Metric label="Coste unitario" value={eur(p.costPerUnitCents)} />
                    <Metric label="Proveedor" value={p.supplierName ?? "-"} />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setPurchasePart(p)} style={ghostBtn}>Comprar</button>
                    <button type="button" onClick={() => setConsumePart(p)} style={ghostBtn}>Consumir</button>
                    <button type="button" onClick={() => setAdjustPart(p)} style={ghostBtn}>Ajustar</button>
                    <button type="button" onClick={() => setHistoryPart(p)} style={ghostBtn}>Historial</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {open ? <PartModal initial={editing} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await load(); }} /> : null}
      {purchasePart ? <PurchasePartModal part={purchasePart} onClose={() => setPurchasePart(null)} onSaved={async () => { setPurchasePart(null); await load(); }} /> : null}
      {consumePart ? <ConsumePartModal part={consumePart} onClose={() => setConsumePart(null)} onSaved={async () => { setConsumePart(null); await load(); }} /> : null}
      {historyPart ? <PartHistoryModal part={historyPart} onClose={() => setHistoryPart(null)} /> : null}
      {adjustPart ? <AdjustPartModal part={adjustPart} onClose={() => setAdjustPart(null)} onSaved={async () => { setAdjustPart(null); await load(); }} /> : null}
    </div>
  );
}
