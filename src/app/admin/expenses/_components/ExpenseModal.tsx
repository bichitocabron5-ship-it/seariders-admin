"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type ExpenseStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELED";
type ExpensePaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "BIZUM"
  | "DIRECT_DEBIT"
  | "OTHER";
type ExpenseCostCenter =
  | "GENERAL"
  | "STORE"
  | "PLATFORM"
  | "BOOTH"
  | "BAR"
  | "HR"
  | "MECHANICS"
  | "OPERATIONS"
  | "MARKETING"
  | "PORT";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  description: string;
  reference: string | null;
  invoiceNumber: string | null;
  categoryId: string;
  vendorId: string | null;
  costCenter: ExpenseCostCenter;
  status: ExpenseStatus;
  paymentMethod: ExpensePaymentMethod | null;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  note: string | null;
  hasInvoice: boolean;
  pricesIncludeTax: boolean;
  taxRateBp: number | null;
};

type ExpenseCategoryRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
};

type ExpenseVendorCategoryLinkRow = {
  id: string;
  isDefault: boolean;
  category: {
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
  };
};

type ExpenseVendorRow = {
  id: string;
  name: string;
  code: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  note: string | null;
  isActive: boolean;
  categoryLinks?: ExpenseVendorCategoryLinkRow[];
};

const EXPENSE_STATUSES: ExpenseStatus[] = ["DRAFT", "PENDING", "PAID", "CANCELED"];
const COST_CENTERS: ExpenseCostCenter[] = [
  "GENERAL",
  "STORE",
  "PLATFORM",
  "BOOTH",
  "BAR",
  "HR",
  "MECHANICS",
  "OPERATIONS",
  "MARKETING",
  "PORT",
];
const PAYMENT_METHODS: ExpensePaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "BIZUM",
  "DIRECT_DEBIT",
  "OTHER",
];

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (/[ÃƒÃ‚Ã¢]/.test(normalized)) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Ignore decode errors and keep original text.
    }
  }

  return normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function isoDate(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function expenseStatusLabel(v: ExpenseStatus) {
  switch (v) {
    case "DRAFT":
      return "Borrador";
    case "PENDING":
      return "Pendiente";
    case "PAID":
      return "Pagado";
    case "CANCELED":
      return "Cancelado";
    default:
      return v;
  }
}

function costCenterLabel(v: ExpenseCostCenter) {
  switch (v) {
    case "GENERAL":
      return "General";
    case "STORE":
      return "Store";
    case "PLATFORM":
      return "Platform";
    case "BOOTH":
      return "Booth";
    case "BAR":
      return "Bar";
    case "HR":
      return "RR. HH.";
    case "MECHANICS":
      return "Mecánica";
    case "OPERATIONS":
      return "Operations";
    case "MARKETING":
      return "Marketing";
    case "PORT":
      return "Port";
    default:
      return v;
  }
}

function paymentMethodLabel(v: ExpensePaymentMethod | null) {
  switch (v) {
    case "CASH":
      return "Efectivo";
    case "CARD":
      return "Tarjeta";
    case "BANK_TRANSFER":
      return "Transferencia";
    case "BIZUM":
      return "Bizum";
    case "DIRECT_DEBIT":
      return "Domiciliación";
    case "OTHER":
      return "Otro";
    default:
      return "-";
  }
}

function taxRateLabel(bp: number | null | undefined) {
  if (bp == null) return "-";
  return `${(bp / 100).toFixed(2)} %`;
}

function eur(cents: number | null | undefined) {
  return `${((cents ?? 0) / 100).toFixed(2)} EUR`;
}

function shortCostCenter(v: ExpenseCostCenter) {
  switch (v) {
    case "GENERAL":
      return "GEN";
    case "STORE":
      return "STR";
    case "PLATFORM":
      return "PLT";
    case "BOOTH":
      return "BTH";
    case "BAR":
      return "BAR";
    case "HR":
      return "HR";
    case "MECHANICS":
      return "MEC";
    case "OPERATIONS":
      return "OPS";
    case "MARKETING":
      return "MKT";
    case "PORT":
      return "PRT";
    default:
      return "GEN";
  }
}

function getVendorsForCategory(vendors: ExpenseVendorRow[], categoryId: string) {
  if (!categoryId) return vendors.filter((v) => v.isActive);

  return vendors.filter((v) =>
    (v.categoryLinks ?? []).some((link) => link.category.id === categoryId)
  );
}

export default function ExpenseModal({
  categories,
  vendors,
  initial,
  onClose,
  onSaved,
  onOpenCategory,
}: {
  categories: ExpenseCategoryRow[];
  vendors: ExpenseVendorRow[];
  initial: ExpenseRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onOpenCategory: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expenseDate, setExpenseDate] = useState(initial ? isoDate(initial.expenseDate) : new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [costCenter, setCostCenter] = useState<ExpenseCostCenter>(initial?.costCenter ?? "GENERAL");
  const [status, setStatus] = useState<ExpenseStatus>(initial?.status ?? "DRAFT");
  const [paymentMethod, setPaymentMethod] = useState<"" | ExpensePaymentMethod>(initial?.paymentMethod ?? "");
  const [amountCents, setAmountCents] = useState(String(initial?.amountCents ?? ""));
  const [dueDate, setDueDate] = useState(isoDate(initial?.dueDate));
  const [paidAt, setPaidAt] = useState(isoDate(initial?.paidAt));
  const [note, setNote] = useState(initial?.note ?? "");
  const [hasInvoice, setHasInvoice] = useState<boolean>(initial?.hasInvoice ?? false);
  const [taxRateBp, setTaxRateBp] = useState<string>(initial?.taxRateBp != null ? String(initial.taxRateBp) : "2100");
  const [entryMode, setEntryMode] = useState<"TOTAL" | "BASE">(initial?.pricesIncludeTax ? "TOTAL" : "BASE");

  const availableVendors = useMemo(() => getVendorsForCategory(vendors, categoryId), [vendors, categoryId]);

  useEffect(() => {
    if (!vendorId) return;
    const stillValid = availableVendors.some((v) => v.id === vendorId);
    if (!stillValid) setVendorId("");
  }, [vendorId, availableVendors]);

  const computed = useMemo(() => {
    const rawAmount = Number(amountCents || 0);
    const rawTax = Number(taxRateBp || 0);

    if (!hasInvoice || rawTax <= 0) {
      return {
        computedBaseCents: rawAmount,
        computedTaxCents: 0,
        computedTotalCents: rawAmount,
      };
    }

    if (entryMode === "TOTAL") {
      const base = Math.round(rawAmount / (1 + rawTax / 10000));
      const tax = rawAmount - base;
      return {
        computedBaseCents: base,
        computedTaxCents: tax,
        computedTotalCents: rawAmount,
      };
    }

    const tax = Math.round(rawAmount * rawTax / 10000);
    const total = rawAmount + tax;
    return {
      computedBaseCents: rawAmount,
      computedTaxCents: tax,
      computedTotalCents: total,
    };
  }, [amountCents, taxRateBp, hasInvoice, entryMode]);

  const parsedTaxRateBp = hasInvoice ? Number(taxRateBp || 0) : 0;
  const normalizedPaidAt = status === "PAID" ? (paidAt || expenseDate) : (paidAt || null);
  const suggestedReference = useMemo(() => {
    const year = expenseDate ? expenseDate.slice(0, 4) : new Date().getFullYear().toString();
    return `EXP-${shortCostCenter(costCenter)}-${year}-XXXX`;
  }, [expenseDate, costCenter]);

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!description.trim()) throw new Error("La descripción es obligatoria.");
      if (!categoryId) throw new Error("Debes seleccionar una categoría.");
      if (hasInvoice && Number.isNaN(parsedTaxRateBp)) throw new Error("El IVA no es válido.");
      if (hasInvoice && parsedTaxRateBp < 0) throw new Error("El IVA no puede ser negativo.");
      if (!hasInvoice && parsedTaxRateBp !== 0) throw new Error("Si no hay factura, el IVA debe ser 0.");
      if (computed.computedBaseCents < 0 || computed.computedTaxCents < 0 || computed.computedTotalCents < 0) {
        throw new Error("Los importes no pueden ser negativos.");
      }
      if (computed.computedTotalCents < computed.computedBaseCents) throw new Error("El total no puede ser menor que la base.");
      if (status === "PAID" && !paidAt) throw new Error("Si el gasto está pagado, debes indicar la fecha de pago.");
      if (status === "PAID" && !paymentMethod) throw new Error("Si el gasto está pagado, indica el método de pago.");

      const payload = {
        expenseDate,
        description: normalizeText(description) ?? "",
        reference: normalizeText(reference) || null,
        invoiceNumber: normalizeText(invoiceNumber) || null,
        categoryId,
        vendorId: vendorId || null,
        costCenter,
        status,
        paymentMethod: paymentMethod || null,
        amountCents: computed.computedBaseCents,
        taxCents: computed.computedTaxCents,
        totalCents: computed.computedTotalCents,
        hasInvoice,
        pricesIncludeTax: entryMode === "TOTAL",
        taxRateBp: hasInvoice ? Number(taxRateBp || 0) : 0,
        dueDate: dueDate || null,
        paidAt: normalizedPaidAt,
        note: normalizeText(note) || null,
      };

      const res = await fetch(initial ? `/api/admin/expenses/${initial.id}` : "/api/admin/expenses", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando gasto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={initial ? "Editar gasto" : "Nuevo gasto"} onClose={onClose}>
      <div style={modalGrid2}>
        <Field label="Fecha">
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} style={inputStyle}>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {expenseStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descripción">
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Centro de coste">
          <select value={costCenter} onChange={(e) => setCostCenter(e.target.value as ExpenseCostCenter)} style={inputStyle}>
            {COST_CENTERS.map((c) => (
              <option key={c} value={c}>
                {costCenterLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Categoría">
          <div style={{ display: "flex", gap: 8 }}>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Selecciona categoría...</option>
              {categories.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={onOpenCategory} style={ghostBtn}>+</button>
          </div>
        </Field>

        <Field label="Proveedor">
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={inputStyle}>
            <option value="">-</option>
            {availableVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.code ? ` (${v.code})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {availableVendors.length} proveedor(es) disponibles para esta categoría
        </div>

        <Field label="Referencia">
          <input value={reference} onChange={(e) => setReference(e.target.value)} style={inputStyle} placeholder={suggestedReference} />
        </Field>

        <Field label="Factura">
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Método de pago">
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "" | ExpensePaymentMethod)} style={inputStyle}>
            <option value="">-</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="¿Tiene factura?">
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
            <input type="checkbox" checked={hasInvoice} onChange={(e) => setHasInvoice(e.target.checked)} />
            <span>Sí, con factura</span>
          </label>
        </Field>

        <Field label="IVA">
          <select value={taxRateBp} onChange={(e) => setTaxRateBp(e.target.value)} disabled={!hasInvoice} style={inputStyle}>
            <option value="0">0 %</option>
            <option value="400">4 %</option>
            <option value="1000">10 %</option>
            <option value="2100">21 %</option>
          </select>
        </Field>

        <Field label="Importe introducido">
          <select value={entryMode} onChange={(e) => setEntryMode(e.target.value as "TOTAL" | "BASE")} disabled={!hasInvoice} style={inputStyle}>
            <option value="TOTAL">Total pagado (con IVA)</option>
            <option value="BASE">Base imponible (sin IVA)</option>
          </select>
        </Field>

        <Field label={entryMode === "TOTAL" ? "Importe total (céntimos)" : "Base imponible (céntimos)"}>
          <input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} style={inputStyle} placeholder="Ej: 12100" />
        </Field>

        <Field label="Base calculada">
          <input value={String(computed.computedBaseCents)} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
        </Field>

        <Field label="IVA calculado">
          <input value={String(computed.computedTaxCents)} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
        </Field>

        <Field label="Total calculado">
          <input value={String(computed.computedTotalCents)} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
        </Field>

        <Field label="Vencimiento">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Pagado el">
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div style={helpBox}>
        Usa céntimos para evitar errores: 12,10 EUR = 1210.
        Ejemplo con IVA 21%: si introduces 1210 como total, la base será 1000 y el IVA 210.
      </div>

      <div style={summaryBox}>
        <div>Base: <b>{eur(computed.computedBaseCents)}</b></div>
        <div>IVA: <b>{eur(computed.computedTaxCents)}</b> ({hasInvoice ? taxRateLabel(Number(taxRateBp || 0)) : "0 %"})</div>
        <div>Total: <b>{eur(computed.computedTotalCents)}</b></div>
      </div>

      <Field label="Nota">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={inputStyle} />
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeader}>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{title}</div>
          <button type="button" onClick={onClose} style={ghostBtn}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

const modalGrid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 12,
  borderRadius: 12,
};

const primaryBtn: CSSProperties = {
  ...opsStyles.primaryButton,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  width: "min(1100px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 24,
  padding: 20,
  border: "1px solid #dbe4ea",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
  display: "grid",
  gap: 14,
};

const modalHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const helpBox: CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
  fontWeight: 800,
};

const summaryBox: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  borderRadius: 12,
  padding: 10,
  display: "grid",
  gap: 4,
  fontSize: 13,
};
