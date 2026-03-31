"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Page, Select } from "@/components/ui";

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  type: string;
  salePriceCents: number;
  costPriceCents: number | null;
  vatRate: string | number;
  controlsStock: boolean;
  currentStock: string | number;
  minStock: string | number;
  unitLabel: string | null;
  isActive: boolean;
  staffEligible: boolean;
  staffPriceCents: number | null;
  category: { id: string; name: string };
};

function productTypeLabel(type: string) {
  switch (type) {
    case "DRINK":
      return "Bebida";
    case "FOOD":
      return "Comida";
    case "SNACK":
      return "Snack";
    case "MERCH":
      return "Merch";
    case "ICE":
      return "Hielo";
    default:
      return "Otro";
  }
}

export default function AdminBarProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("DRINK");
  const [salePriceEuros, setSalePriceEuros] = useState("");
  const [costPriceEuros, setCostPriceEuros] = useState("0");
  const [vatRate, setVatRate] = useState("21");
  const [controlsStock, setControlsStock] = useState(true);
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [unitLabel, setUnitLabel] = useState("ud");
  const [staffEligible, setStaffEligible] = useState(false);
  const [staffPriceEuros, setStaffPriceEuros] = useState("1");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("DRINK");
  const [editSalePriceEuros, setEditSalePriceEuros] = useState("");
  const [editCostPriceEuros, setEditCostPriceEuros] = useState("0");
  const [editVatRate, setEditVatRate] = useState("21");
  const [editControlsStock, setEditControlsStock] = useState(true);
  const [editCurrentStock, setEditCurrentStock] = useState("0");
  const [editMinStock, setEditMinStock] = useState("0");
  const [editUnitLabel, setEditUnitLabel] = useState("ud");
  const [editStaffEligible, setEditStaffEligible] = useState(false);
  const [editStaffPriceEuros, setEditStaffPriceEuros] = useState("1");

  function centsFromEuroInput(s: string) {
    const n = Number((s ?? "").replace(",", "."));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/admin/bar/categories", { cache: "no-store" }),
        fetch("/api/admin/bar/products", { cache: "no-store" }),
      ]);
      if (!catRes.ok) throw new Error(await catRes.text());
      if (!prodRes.ok) throw new Error(await prodRes.text());
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      setCategories((catData.rows ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      setRows(prodData.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProduct() {
    try {
      setError(null);
      const res = await fetch("/api/admin/bar/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name,
          type,
          salePriceCents: centsFromEuroInput(salePriceEuros),
          costPriceCents: centsFromEuroInput(costPriceEuros),
          vatRate: Number(vatRate),
          controlsStock,
          currentStock: Number(currentStock || 0),
          minStock: Number(minStock || 0),
          unitLabel,
          staffEligible,
          staffPriceCents: staffEligible ? centsFromEuroInput(staffPriceEuros) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setSalePriceEuros("");
      setCostPriceEuros("0");
      setCurrentStock("0");
      setMinStock("0");
      setStaffEligible(false);
      setStaffPriceEuros("1");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleActive(row: Product) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row: Product) {
    setEditingId(row.id);
    setEditCategoryId(row.category.id);
    setEditName(row.name);
    setEditType(row.type);
    setEditSalePriceEuros((Number(row.salePriceCents) / 100).toFixed(2));
    setEditCostPriceEuros((Number(row.costPriceCents ?? 0) / 100).toFixed(2));
    setEditVatRate(String(row.vatRate));
    setEditControlsStock(row.controlsStock);
    setEditCurrentStock(String(row.currentStock));
    setEditMinStock(String(row.minStock));
    setEditUnitLabel(row.unitLabel ?? "ud");
    setEditStaffEligible(row.staffEligible);
    setEditStaffPriceEuros(row.staffPriceCents != null ? (Number(row.staffPriceCents) / 100).toFixed(2) : "1");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCategoryId("");
    setEditName("");
    setEditType("DRINK");
    setEditSalePriceEuros("");
    setEditCostPriceEuros("0");
    setEditVatRate("21");
    setEditControlsStock(true);
    setEditCurrentStock("0");
    setEditMinStock("0");
    setEditUnitLabel("ud");
    setEditStaffEligible(false);
    setEditStaffPriceEuros("1");
  }

  async function saveEdit(row: Product) {
    try {
      setBusyId(row.id);
      setError(null);
      const res = await fetch(`/api/admin/bar/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editCategoryId,
          name: editName,
          type: editType,
          salePriceCents: centsFromEuroInput(editSalePriceEuros),
          costPriceCents: centsFromEuroInput(editCostPriceEuros),
          vatRate: Number(editVatRate),
          controlsStock: editControlsStock,
          currentStock: Number(editCurrentStock || 0),
          minStock: Number(editMinStock || 0),
          unitLabel: editUnitLabel,
          staffEligible: editStaffEligible,
          staffPriceCents: editStaffEligible ? centsFromEuroInput(editStaffPriceEuros) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      cancelEdit();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const headerRight = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link href="/admin/bar" style={ghostLink}>
        Módulo Bar
      </Link>
      <Link href="/admin/bar/categories" style={ghostLink}>
        Categorías
      </Link>
    </div>
  );

  return (
    <Page title="Admin Bar - Productos" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card title="Nuevo producto" right={<div style={{ fontSize: 12, color: "#64748b" }}>Ejemplo: Agua 50 cl, Cerveza lata, Neopreno adulto, Bolsa de hielo</div>}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecciona la categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Agua 50 cl" />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="DRINK">Bebida</option>
            <option value="FOOD">Comida</option>
            <option value="SNACK">Snack</option>
            <option value="MERCH">Merch</option>
            <option value="ICE">Hielo</option>
            <option value="OTHER">Otro</option>
          </Select>
          <Input value={salePriceEuros} onChange={(e) => setSalePriceEuros(e.target.value)} placeholder="Ej: 2,50" />
          <Input value={costPriceEuros} onChange={(e) => setCostPriceEuros(e.target.value)} placeholder="Ej: 1,00" />
          <Input value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder="Ej: 10 o 21" />
          <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Ej: ud, botella, lata, bolsa" />
          <Input value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} placeholder="Ej: 24" />
          <Input value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="Ej: 6" />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={controlsStock} onChange={(e) => setControlsStock(e.target.checked)} />
            Controla stock
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={staffEligible} onChange={(e) => setStaffEligible(e.target.checked)} />
          Activar precio staff
        </label>

        {staffEligible ? (
          <Input value={staffPriceEuros} onChange={(e) => setStaffPriceEuros(e.target.value)} placeholder="Ej: 1,50" />
        ) : null}

        <div style={{ marginTop: 12 }}>
          <Button onClick={createProduct}>Crear producto</Button>
        </div>
      </Card>

      <Card title="Productos">
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 120px 120px 140px auto", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{row.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {row.category.name} - {productTypeLabel(row.type)}
                    </div>
                    <div>
                      {row.staffEligible ? `Staff ${(Number(row.staffPriceCents ?? 0) / 100).toFixed(2)} EUR` : "Sin precio staff"}
                    </div>
                  </div>
                  <div>Coste {(Number(row.costPriceCents ?? 0) / 100).toFixed(2)} €</div>
                  <div>{(Number(row.salePriceCents) / 100).toFixed(2)} EUR</div>
                  <div>IVA {row.vatRate}%</div>
                  <div>Stock {String(row.currentStock)}</div>
                  <div>{row.isActive ? "Activo" : "Inactivo"}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => startEdit(row)} disabled={busyId === row.id}>
                      Editar
                    </Button>
                    <Button onClick={() => void toggleActive(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? "Guardando..." : row.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>

                {editingId === row.id ? (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", paddingTop: 8, borderTop: "1px dashed #cbd5e1" }}>
                    <Select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                      <option value="">Selecciona la categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ej: Agua 50 cl" />
                    <Select value={editType} onChange={(e) => setEditType(e.target.value)}>
                      <option value="DRINK">Bebida</option>
                      <option value="FOOD">Comida</option>
                      <option value="SNACK">Snack</option>
                      <option value="MERCH">Merch</option>
                      <option value="ICE">Hielo</option>
                      <option value="OTHER">Otro</option>
                    </Select>
                    <Input value={editSalePriceEuros} onChange={(e) => setEditSalePriceEuros(e.target.value)} placeholder="Ej: 2,50" />
                    <Input value={editCostPriceEuros} onChange={(e) => setEditCostPriceEuros(e.target.value)} placeholder="Ej: 1,00" />
                    <Input value={editVatRate} onChange={(e) => setEditVatRate(e.target.value)} placeholder="Ej: 10 o 21" />
                    <Input value={editUnitLabel} onChange={(e) => setEditUnitLabel(e.target.value)} placeholder="Ej: ud, botella, lata, bolsa" />
                    <Input value={editCurrentStock} onChange={(e) => setEditCurrentStock(e.target.value)} placeholder="Ej: 24" />
                    <Input value={editMinStock} onChange={(e) => setEditMinStock(e.target.value)} placeholder="Ej: 6" />
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={editControlsStock} onChange={(e) => setEditControlsStock(e.target.checked)} />
                      Controla stock
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={editStaffEligible} onChange={(e) => setEditStaffEligible(e.target.checked)} />
                      Activar precio staff
                    </label>
                    {editStaffEligible ? (
                      <Input value={editStaffPriceEuros} onChange={(e) => setEditStaffPriceEuros(e.target.value)} placeholder="Ej: 1,50" />
                    ) : (
                      <div />
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={() => void saveEdit(row)} disabled={busyId === row.id}>
                        {busyId === row.id ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button onClick={cancelEdit} disabled={busyId === row.id}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}

const ghostLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 900,
};
