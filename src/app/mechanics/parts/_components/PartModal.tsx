// src/app/mechanics/parts/_components/PartModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PartRow } from "./types";
import { PART_CATEGORIES } from "./categories";
import {
  errorBox,
  ghostBtn,
  Input,
  modalGrid2,
  ModalShell,
  primaryBtn,
  Field,
  inputStyle,
  sectionCard,
} from "./ui";

type VendorOption = {
  id: string;
  name: string;
  code: string | null;
  taxId: string | null;
  isActive: boolean;
};

const EXPENSE_CATEGORY_CODE = "SPARE_PARTS";

export default function PartModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: PartRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? PART_CATEGORIES[0]);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [stockQty, setStockQty] = useState(String(initial?.stockQty ?? 0));
  const [minStockQty, setMinStockQty] = useState(String(initial?.minStockQty ?? 0));
  const [costPerUnitCents, setCostPerUnitCents] = useState(
    initial?.costPerUnitCents != null ? String(initial.costPerUnitCents) : ""
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<VendorOption[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSuppliers() {
      try {
        setSupplierLoading(true);

        const qs = new URLSearchParams({
          onlyActive: "true",
          categoryCode: EXPENSE_CATEGORY_CODE,
          limit: "50",
        });

        if (supplierQuery.trim()) {
          qs.set("q", supplierQuery.trim());
        }

        const res = await fetch(`/api/expenses/vendors?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();

        if (!cancelled) {
          setSupplierOptions(json.rows ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando proveedores");
        }
      } finally {
        if (!cancelled) {
          setSupplierLoading(false);
        }
      }
    }

    loadSuppliers();
    return () => {
      cancelled = true;
    };
  }, [supplierQuery]);

  const selectedSupplier = useMemo(() => {
    return supplierOptions.find((v) => v.name === supplierName) ?? null;
  }, [supplierOptions, supplierName]);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      if (!name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }

      const body = {
        sku: sku.trim() || null,
        name: name.trim(),
        category: category.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        unit: unit.trim() || null,
        stockQty: Number(stockQty || 0),
        minStockQty: Number(minStockQty || 0),
        costPerUnitCents: costPerUnitCents.trim() ? Number(costPerUnitCents) : null,
        supplierName: supplierName.trim() || null,
        note: note.trim() || null,
        isActive,
      };

      const res = await fetch(
        isEdit ? `/api/mechanics/parts/${initial!.id}` : "/api/mechanics/parts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando recambio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar recambio" : "Nuevo recambio"} onClose={() => (busy ? null : onClose())}>
      <div style={sectionCard}>
        <div style={modalGrid2}>
          <Input label="SKU" value={sku} onChange={setSku} />
          <Input label="Nombre" value={name} onChange={setName} />

          <Field label="Categoría">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {PART_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Input label="Marca" value={brand} onChange={setBrand} />
          <Input label="Modelo" value={model} onChange={setModel} />
          <Input label="Unidad" value={unit} onChange={setUnit} />
          <Input label="Stock" value={stockQty} onChange={setStockQty} />
          <Input label="Mínimo" value={minStockQty} onChange={setMinStockQty} />
          <Input label="Coste unitario (céntimos)" value={costPerUnitCents} onChange={setCostPerUnitCents} />

          <Field label="Buscar proveedor de admin">
            <input
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
              style={inputStyle}
              placeholder="Nombre, código o NIF"
            />
          </Field>

          <Field label="Proveedor">
            <select value={supplierName} onChange={(e) => setSupplierName(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar proveedor</option>
              {supplierOptions.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                  {v.code ? ` (${v.code})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>

          <Field label="Nota">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={inputStyle} />
          </Field>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {supplierLoading
          ? "Cargando proveedores..."
          : `${supplierOptions.length} proveedor(es) cargados desde admin`}
      </div>

      {selectedSupplier ? (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900 }}>
            {selectedSupplier.name}
            {selectedSupplier.code ? ` (${selectedSupplier.code})` : ""}
          </div>
          <div style={{ opacity: 0.8 }}>{selectedSupplier.taxId || "Sin NIF/CIF"}</div>
        </div>
      ) : null}

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        <button type="button" onClick={save} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}
