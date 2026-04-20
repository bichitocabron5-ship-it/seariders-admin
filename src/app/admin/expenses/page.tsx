// src/app/admin/expenses/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ApplyBarRestockModal from "./_components/ApplyBarRestockModal";
import CategoryModal from "./_components/CategoryModal";
import ExpensesDirectorySection from "./_components/ExpensesDirectorySection";
import ExpenseModal from "./_components/ExpenseModal";
import ExpensesLedgerSection from "./_components/ExpensesLedgerSection";
import VendorModal from "./_components/VendorModal";

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

  costCenter: ExpenseCostCenter;
  status: ExpenseStatus;
  paymentMethod: ExpensePaymentMethod | null;

  amountCents: number;
  taxCents: number | null;
  totalCents: number | null;

  hasInvoice: boolean;
  pricesIncludeTax: boolean;
  taxRateBp: number | null;

  paidAt: string | null;
  dueDate: string | null;
  note: string | null;

  categoryId: string;
  category: {
    id: string;
    name: string;
    code: string | null;
  };

  vendorId: string | null;
  vendor: {
    id: string;
    name: string;
    code: string | null;
    taxId: string | null;
  } | null;

  maintenanceEventId: string | null;
  sparePartId: string | null;
  employeeId: string | null;

  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string;
    fullName: string;
  } | null;

  barRestock?: {
    id: string;
    appliedAt: string;
  } | null;

  createdAt: string;
  updatedAt: string;
};

type ExpenseCategoryRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  _count?: { expenses: number };
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
  _count?: { expenses: number };
};

type ExpensesResponse = {
  ok: true;
  rows: ExpenseRow[];
  summary: {
    count: number;
    amountCents: number;
    taxCents: number;
    totalCents: number;
    paidCents: number;
    pendingCents: number;
  };
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
] as const;
const EXPENSE_CATEGORIES_API = "/api/admin/expenses/expense-categories";
const EXPENSE_VENDORS_API = "/api/admin/expenses/expense-vendors";
const EXPENSE_FILTERS_STORAGE_KEY = "admin-expenses-filters";

type StoredExpenseFilters = {
  q: string;
  status: "" | ExpenseStatus;
  costCenter: "" | ExpenseCostCenter;
  categoryId: string;
  vendorId: string;
  from: string;
  to: string;
};

function loadStoredExpenseFilters(): StoredExpenseFilters {
  const empty: StoredExpenseFilters = {
    q: "",
    status: "",
    costCenter: "",
    categoryId: "",
    vendorId: "",
    from: "",
    to: "",
  };

  if (typeof window === "undefined") return empty;

  try {
    const raw = window.localStorage.getItem(EXPENSE_FILTERS_STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as Partial<StoredExpenseFilters>;

    return {
      q: typeof parsed.q === "string" ? parsed.q : "",
      status: typeof parsed.status === "string" ? (parsed.status as "" | ExpenseStatus) : "",
      costCenter: typeof parsed.costCenter === "string" ? (parsed.costCenter as "" | ExpenseCostCenter) : "",
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : "",
      vendorId: typeof parsed.vendorId === "string" ? parsed.vendorId : "",
      from: typeof parsed.from === "string" ? parsed.from : "",
      to: typeof parsed.to === "string" ? parsed.to : "",
    };
  } catch {
    return empty;
  }
}

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (/[ÃƒÃ‚Ã¢]/.test(normalized)) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Keep original value if decoding fails.
    }
  }

  return normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function normalizeExpenseRow(row: ExpenseRow): ExpenseRow {
  return {
    ...row,
    description: normalizeText(row.description) ?? "",
    reference: normalizeText(row.reference) ?? null,
    invoiceNumber: normalizeText(row.invoiceNumber) ?? null,
    note: normalizeText(row.note) ?? null,
    category: row.category
      ? {
          ...row.category,
          name: normalizeText(row.category.name) ?? row.category.name,
          code: normalizeText(row.category.code) ?? null,
        }
      : row.category,
    vendor: row.vendor
      ? {
          ...row.vendor,
          name: normalizeText(row.vendor.name) ?? row.vendor.name,
          code: normalizeText(row.vendor.code) ?? null,
          taxId: normalizeText(row.vendor.taxId) ?? null,
        }
      : row.vendor,
    barRestock: row.barRestock ?? null,
  };
}

function taxRateLabel(bp: number | null | undefined) {
  if (bp == null) return "-";
  return `${(bp / 100).toFixed(2)} %`;
}

function eur(cents: number | null | undefined) {
  return `${((cents ?? 0) / 100).toFixed(2)} EUR`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-ES");
  } catch {
    return value;
  }
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
      return "Tienda";
    case "PLATFORM":
      return "Plataforma";
    case "BOOTH":
      return "Carpa";
    case "BAR":
      return "Bar";
    case "HR":
      return "RRHH";
    case "MECHANICS":
      return "Mecánica";
    case "OPERATIONS":
      return "Operativa";
    case "MARKETING":
      return "Marketing";
    case "PORT":
      return "Puerto";
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
      return "Domiciliacion";
    case "OTHER":
      return "Otro";
    default:
      return "-";
  }
}

function statusBadgeStyle(status: ExpenseStatus): React.CSSProperties {
  if (status === "PAID") {
    return {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 900,
      fontSize: 12,
    };
  }
  if (status === "PENDING") {
    return {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 900,
      fontSize: 12,
    };
  }
  if (status === "CANCELED") {
    return {
      border: "1px solid #fecaca",
      background: "#fff1f2",
      color: "#991b1b",
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 900,
      fontSize: 12,
    };
  }
  return {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
  };
}

export default function AdminExpensesPage() {
  const [storedFilters] = useState<StoredExpenseFilters>(() => loadStoredExpenseFilters());
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<ExpensesResponse["summary"] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [vendors, setVendors] = useState<ExpenseVendorRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(storedFilters.q);
  const [status, setStatus] = useState<"" | ExpenseStatus>(storedFilters.status);
  const [costCenter, setCostCenter] = useState<"" | ExpenseCostCenter>(storedFilters.costCenter);
  const [categoryId, setCategoryId] = useState(storedFilters.categoryId);
  const [vendorId, setVendorId] = useState(storedFilters.vendorId);
  const [from, setFrom] = useState(storedFilters.from);
  const [to, setTo] = useState(storedFilters.to);

  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryRow | null>(null);
  const [editingVendor, setEditingVendor] = useState<ExpenseVendorRow | null>(null);

  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openVendorModal, setOpenVendorModal] = useState(false);

  const [restockingExpense, setRestockingExpense] = useState<ExpenseRow | null>(null);

  const filteredVendors = useMemo(() => {
    if (!categoryId) return vendors.filter((v) => v.isActive);

    return vendors.filter((v) =>
      (v.categoryLinks ?? []).some((link) => link.category.id === categoryId)
    );
  }, [vendors, categoryId]);

  const activeCategoryCount = useMemo(() => categories.filter((category) => category.isActive).length, [categories]);
  const activeVendorCount = useMemo(() => vendors.filter((vendor) => vendor.isActive).length, [vendors]);
  const categoryStats = useMemo(
    () =>
      rows.reduce<Record<string, { expenseCount: number; totalCents: number }>>((acc, row) => {
        const current = acc[row.categoryId] ?? { expenseCount: 0, totalCents: 0 };
        current.expenseCount += 1;
        current.totalCents += Number(row.totalCents ?? row.amountCents ?? 0);
        acc[row.categoryId] = current;
        return acc;
      }, {}),
    [rows]
  );
  const vendorStats = useMemo(
    () =>
      rows.reduce<Record<string, { expenseCount: number; totalCents: number }>>((acc, row) => {
        if (!row.vendorId) return acc;
        const current = acc[row.vendorId] ?? { expenseCount: 0, totalCents: 0 };
        current.expenseCount += 1;
        current.totalCents += Number(row.totalCents ?? row.amountCents ?? 0);
        acc[row.vendorId] = current;
        return acc;
      }, {}),
    [rows]
  );
  
  useEffect(() => {
    if (!vendorId) return;

    const stillValid = filteredVendors.some((v) => v.id === vendorId);
    if (!stillValid) setVendorId("");
  }, [vendorId, filteredVendors]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPENSE_FILTERS_STORAGE_KEY,
        JSON.stringify({ q, status, costCenter, categoryId, vendorId, from, to } satisfies StoredExpenseFilters)
      );
    } catch {
      // Ignore storage write issues so filters still work in-memory.
    }
  }, [q, status, costCenter, categoryId, vendorId, from, to]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (costCenter) p.set("costCenter", costCenter);
    if (categoryId) p.set("categoryId", categoryId);
    if (vendorId) p.set("vendorId", vendorId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [q, status, costCenter, categoryId, vendorId, from, to]);

  const loadLookups = useCallback(async () => {
    const [catRes, venRes] = await Promise.all([
      fetch(EXPENSE_CATEGORIES_API, { cache: "no-store" }),
      fetch(EXPENSE_VENDORS_API, { cache: "no-store" }),
    ]);

    if (!catRes.ok) throw new Error(await catRes.text());
    if (!venRes.ok) throw new Error(await venRes.text());

    const catJson = await catRes.json();
    const venJson = await venRes.json();

    setCategories(
      (catJson.rows ?? []).map((c: ExpenseCategoryRow) => ({
        ...c,
        name: normalizeText(c.name) ?? c.name,
        code: normalizeText(c.code) ?? null,
        description: normalizeText(c.description) ?? null,
      }))
    );

    setVendors(
      (venJson.rows ?? []).map((v: ExpenseVendorRow) => ({
        ...v,
        name: normalizeText(v.name) ?? v.name,
        code: normalizeText(v.code) ?? null,
        taxId: normalizeText(v.taxId) ?? null,
        email: normalizeText(v.email) ?? null,
        phone: normalizeText(v.phone) ?? null,
        contactPerson: normalizeText(v.contactPerson) ?? null,
        note: normalizeText(v.note) ?? null,
        categoryLinks: (v.categoryLinks ?? []).map((link) => ({
          ...link,
          category: {
            ...link.category,
            name: normalizeText(link.category.name) ?? link.category.name,
            code: normalizeText(link.category.code) ?? null,
          },
        })),
      }))
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [expensesRes] = await Promise.all([
        fetch(`/api/admin/expenses?${queryString}`, { cache: "no-store" }),
        loadLookups(),
      ]);

      if (!expensesRes.ok) throw new Error(await expensesRes.text());

      const json = (await expensesRes.json()) as ExpensesResponse;
      setRows((json.rows ?? []).map(normalizeExpenseRow));
      setSummary(json.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando gastos");
    } finally {
      setLoading(false);
    }
  }, [queryString, loadLookups]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreateExpense() {
    setEditing(null);
    setOpenExpenseModal(true);
  }

  function openEditExpense(row: ExpenseRow) {
    setEditing(row);
    setOpenExpenseModal(true);
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setOpenCategoryModal(true);
  }

  function openEditCategory(row: ExpenseCategoryRow) {
    setEditingCategory(row);
    setOpenCategoryModal(true);
  }

  function openCreateVendor() {
    setEditingVendor(null);
    setOpenVendorModal(true);
  }

  function openEditVendor(row: ExpenseVendorRow) {
    setEditingVendor(row);
    setOpenVendorModal(true);
  }

  return (
    <div style={pageShell}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={eyebrowStyle}>Finanzas operativas</div>
          <div style={{ fontWeight: 950, fontSize: 34, color: "#0f172a" }}>Admin / Gastos</div>
          <div style={heroCopyStyle}>
            Control de gasto, proveedores y categorias con una vista mas clara para contabilidad diaria.
          </div>
          <div style={heroBadges}>
            <MiniBadge label="Gastos" value={String(summary?.count ?? rows.length)} />
            <MiniBadge label="Categorías" value={String(categories.filter((category) => category.isActive).length)} />
            <MiniBadge label="Proveedores" value={String(vendors.filter((vendor) => vendor.isActive).length)} />
            <MiniBadge label="Pendientes" value={String(rows.filter((row) => row.status === "PENDING").length)} warn={rows.some((row) => row.status === "PENDING")} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/admin" style={ghostLinkBtn}>Admin</a>
          <button type="button" onClick={load} style={ghostBtn}>Refrescar</button>
          <button type="button" onClick={openCreateCategory} style={ghostBtn}>
            + Nueva categoria
          </button>

          <button type="button" onClick={openCreateVendor} style={ghostBtn}>
            + Nuevo proveedor
          </button>

          <button type="button" onClick={openCreateExpense} style={primaryBtn}>
            + Nuevo gasto
          </button>
        </div>
      </section>

      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Filtros</div>
          <div style={sectionCaption}>Refina la vista por estado, centro, categoria, proveedor o rango.</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 2fr) repeat(6, minmax(120px, 1fr)) auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <Field label="Buscar">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Descripcion, ref, factura, categoria, proveedor..."
              style={inputStyle}
            />
          </Field>

          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as "" | ExpenseStatus)} style={inputStyle}>
              <option value="">Todos</option>
              {EXPENSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {expenseStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Centro de coste">
            <select
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value as "" | ExpenseCostCenter)}
              style={inputStyle}
            >
              <option value="">Todos</option>
              {COST_CENTERS.map((c) => (
                <option key={c} value={c}>
                  {costCenterLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Categoría">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Proveedor">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {filteredVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Desde">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Hasta">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </Field>

          <button type="button" onClick={load} style={primaryBtn}>
            Aplicar
          </button>
        </div>
      </div>

      {summary ? (
        <div style={kpiGrid}>
          <Kpi title="Gastos" value={summary.count} />
          <Kpi title="Base" value={eur(summary.amountCents)} />
          <Kpi title="Impuestos" value={eur(summary.taxCents)} />
          <Kpi title="Total" value={eur(summary.totalCents)} />
          <Kpi title="Pagado" value={eur(summary.paidCents)} />
          <Kpi title="Pendiente" value={eur(summary.pendingCents)} warn={summary.pendingCents > 0} />
        </div>
      ) : null}

      {loading ? <div style={loadingBox}>Cargando gastos...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error ? (
        <ExpensesLedgerSection
          rows={rows}
          onEditExpense={openEditExpense}
          onApplyBarRestock={(row) => setRestockingExpense(row)}
          expenseStatusLabel={expenseStatusLabel}
          costCenterLabel={costCenterLabel}
          paymentMethodLabel={paymentMethodLabel}
          taxRateLabel={taxRateLabel}
          eur={eur}
          fmtDate={fmtDate}
          statusBadgeStyle={statusBadgeStyle}
        />
      ) : null}

      <ExpensesDirectorySection
        categories={categories}
        vendors={vendors}
        activeCategoryCount={activeCategoryCount}
        activeVendorCount={activeVendorCount}
        categoryStats={categoryStats}
        vendorStats={vendorStats}
        onEditCategory={openEditCategory}
        onEditVendor={openEditVendor}
      />

      {openExpenseModal ? (
        <ExpenseModal
          categories={categories}
          vendors={vendors}
          initial={editing}
          onClose={() => setOpenExpenseModal(false)}
          onSaved={async () => {
            setOpenExpenseModal(false);
            await load();
          }}
          onOpenCategory={() => setOpenCategoryModal(true)}
        />
      ) : null}

      {openCategoryModal ? (
        <CategoryModal
          initial={editingCategory}
          onClose={() => {
            setOpenCategoryModal(false);
            setEditingCategory(null);
          }}
          onSaved={async () => {
            setOpenCategoryModal(false);
            setEditingCategory(null);
            await loadLookups();
          }}
        />
      ) : null}

      {restockingExpense ? (
        <ApplyBarRestockModal
          expense={restockingExpense}
          onClose={() => setRestockingExpense(null)}
          onSaved={async () => {
            setRestockingExpense(null);
            await load();
          }}
        />
      ) : null}

      {openVendorModal ? (
        <VendorModal
          categories={categories}
          initial={editingVendor}
          onClose={() => {
            setOpenVendorModal(false);
            setEditingVendor(null);
          }}
          onSaved={async () => {
            setOpenVendorModal(false);
            setEditingVendor(null);
            await loadLookups();
          }}
        />
      ) : null}
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
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}

function Kpi({
  title,
  value,
  warn,
}: {
  title: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        border: warn ? "1px solid #fde68a" : "1px solid #e5e7eb",
        background: warn ? "#fffbeb" : "#fff",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 24,
          fontWeight: 950,
          color: warn ? "#92400e" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBadge({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        border: warn ? "1px solid #fde68a" : "1px solid #dbe4ea",
        background: warn ? "#fffbeb" : "rgba(255,255,255,0.82)",
        borderRadius: 18,
        padding: "10px 12px",
        display: "grid",
        gap: 4,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 950, color: warn ? "#92400e" : "#0f172a" }}>{value}</div>
    </div>
  );
}

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const pageShell: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
  background:
    "radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 28%), radial-gradient(circle at top right, rgba(249, 115, 22, 0.08), transparent 22%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 28,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #ecfeff 100%)",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f766e",
};

const heroCopyStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#475569",
  maxWidth: 760,
};

const heroBadges: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const sectionCaption: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const loadingBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  color: "#334155",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  background: "#fff",
  borderRadius: 24,
  padding: 18,
  display: "grid",
  gap: 14,
  boxShadow: "0 20px 48px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 950,
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  color: "#0f172a",
};

const ghostLinkBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  color: "#0f172a",
  textDecoration: "none",
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

