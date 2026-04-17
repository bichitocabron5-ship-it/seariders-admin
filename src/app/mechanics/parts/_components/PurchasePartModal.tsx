// src/app/mechanics/parts/_components/PurchasePartModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PartRow, PaymentMethod } from "./types";
import {
  errorBox,
  ghostBtn,
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
  categoryLinks?: Array<{
    isDefault: boolean;
    category: {
      id: string;
      name: string;
      code: string | null;
    };
  }>;
};

const EXPENSE_CATEGORY_CODE = "SPARE_PARTS";

export default function PurchasePartModal({
  part,
  onClose,
  onSaved,
}: {
  part: PartRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qty, setQty] = useState("1");
  const [unitCostCents, setUnitCostCents] = useState(
    part.costPerUnitCents != null ? String(part.costPerUnitCents) : ""
  );
  const [vendorId, setVendorId] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);

  const [note, setNote] = useState("");
  const [createExpense, setCreateExpense] = useState(true);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [expenseStatus, setExpenseStatus] = useState<"PAID" | "PENDING">(
    "PAID"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("");
  const [hasInvoice, setHasInvoice] = useState(false);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [taxRateBp, setTaxRateBp] = useState("2100");

  useEffect(() => {
    let cancelled = false;

    async function loadVendors() {
      try {
        setVendorsLoading(true);

        const baseParams = {
          onlyActive: "true",
          limit: "50",
        } as const;

        const qs = new URLSearchParams({
          ...baseParams,
          categoryCode: EXPENSE_CATEGORY_CODE,
        });

        if (vendorQuery.trim()) {
          qs.set("q", vendorQuery.trim());
        }

        let res = await fetch(`/api/expenses/vendors?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        let json = await res.json();

        // Fallback: if vendors exist in admin but are not explicitly linked
        // to the spare-parts category yet, still make them selectable here.
        if ((json.rows?.length ?? 0) === 0) {
          const fallbackQs = new URLSearchParams(baseParams);
          if (vendorQuery.trim()) {
            fallbackQs.set("q", vendorQuery.trim());
          }

          res = await fetch(`/api/expenses/vendors?${fallbackQs.toString()}`, {
            cache: "no-store",
          });

          if (!res.ok) throw new Error(await res.text());
          json = await res.json();
        }

        if (!cancelled) {
          setVendorOptions(json.rows ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando proveedores");
        }
      } finally {
        if (!cancelled) setVendorsLoading(false);
      }
    }

    loadVendors();
    return () => {
      cancelled = true;
    };
  }, [vendorQuery]);

  const selectedVendor = useMemo(
    () => vendorOptions.find((v) => v.id === vendorId) ?? null,
    [vendorOptions, vendorId]
  );

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      const parsedQty = Number(qty);
      const parsedUnitCost = Number(unitCostCents || 0);

      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        throw new Error("La cantidad debe ser mayor que 0.");
      }

      if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
        throw new Error("El coste unitario no es válido.");
      }

      if (expenseStatus === "PAID" && !paymentMethod && createExpense) {
        throw new Error("Si el gasto está pagado, indica el método de pago.");
      }

      const res = await fetch("/api/mechanics/parts/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sparePartId: part.id,
          qty: parsedQty,
          unitCostCents: parsedUnitCost,
          vendorId: vendorId || null,
          note: note || null,
          createExpense,
          expenseDate,
          expenseStatus,
          paymentMethod: paymentMethod || null,
          hasInvoice,
          pricesIncludeTax,
          taxRateBp: hasInvoice ? Number(taxRateBp || 0) : 0,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error registrando compra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Comprar · ${part.name}`} onClose={onClose}>
      <div style={sectionCard}>
        <div style={modalGrid2}>
          <Field label="Cantidad">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Coste unitario (céntimos)">
            <input
              value={unitCostCents}
              onChange={(e) => setUnitCostCents(e.target.value)}
              style={inputStyle}
              placeholder="Ej: 1850"
            />
          </Field>

          <Field label="Buscar proveedor">
            <input
              value={vendorQuery}
              onChange={(e) => setVendorQuery(e.target.value)}
              style={inputStyle}
              placeholder="Nombre, código o NIF"
            />
          </Field>

          <Field label="Proveedor">
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Seleccionar proveedor —</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.code ? ` (${v.code})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fecha del gasto">
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Estado del gasto">
            <select
              value={expenseStatus}
              onChange={(e) => setExpenseStatus(e.target.value as "PAID" | "PENDING")}
              style={inputStyle}
            >
              <option value="PAID">Pagado</option>
              <option value="PENDING">Pendiente</option>
            </select>
          </Field>

          <Field label="Método de pago">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              style={inputStyle}
            >
              <option value="">—</option>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="BIZUM">Bizum</option>
              <option value="DIRECT_DEBIT">Domiciliación</option>
              <option value="OTHER">Otro</option>
            </select>
          </Field>

          <Field label="¿Crear gasto contable?">
            <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
              <input
                type="checkbox"
                checked={createExpense}
                onChange={(e) => setCreateExpense(e.target.checked)}
              />
              <span>Sí</span>
            </label>
          </Field>

          <Field label="¿Tiene factura?">
            <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
              <input
                type="checkbox"
                checked={hasInvoice}
                onChange={(e) => setHasInvoice(e.target.checked)}
              />
              <span>Sí</span>
            </label>
          </Field>

          <Field label="IVA">
            <select
              value={taxRateBp}
              onChange={(e) => setTaxRateBp(e.target.value)}
              disabled={!hasInvoice}
              style={inputStyle}
            >
              <option value="0">0 %</option>
              <option value="400">4 %</option>
              <option value="1000">10 %</option>
              <option value="2100">21 %</option>
            </select>
          </Field>

          <Field label="Precio introducido">
            <select
              value={pricesIncludeTax ? "TOTAL" : "BASE"}
              onChange={(e) => setPricesIncludeTax(e.target.value === "TOTAL")}
              disabled={!hasInvoice}
              style={inputStyle}
            >
              <option value="TOTAL">Con IVA</option>
              <option value="BASE">Sin IVA</option>
            </select>
          </Field>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {vendorsLoading
          ? "Cargando proveedores..."
          : `${vendorOptions.length} proveedor(es) disponibles para Recambios`}
      </div>

      {selectedVendor ? (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900 }}>
            {selectedVendor.name}
            {selectedVendor.code ? ` (${selectedVendor.code})` : ""}
          </div>
          <div style={{ opacity: 0.8 }}>
            {selectedVendor.taxId || "Sin NIF/CIF"}
          </div>
        </div>
      ) : null}

      <Field label="Nota">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar compra"}
        </button>
      </div>
    </ModalShell>
  );
}
