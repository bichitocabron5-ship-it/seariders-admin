// src/app/admin/expenses/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

type BarProductLookup = {
  id: string;
  name: string;
  unitLabel: string | null;
  salePriceCents?: number;
  costPriceCents?: number | null;
};

type BarRestockLine = {
  productId: string;
  quantity: string;
  unitCostEuros: string;
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
const PAYMENT_METHODS: ExpensePaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "BIZUM",
  "DIRECT_DEBIT",
  "OTHER",
];
const EXPENSE_CATEGORIES_API = "/api/admin/expenses/expense-categories";
const EXPENSE_VENDORS_API = "/api/admin/expenses/expense-vendors";

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

function isoDate(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
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
      return "Mecanica";
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
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<ExpensesResponse["summary"] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [vendors, setVendors] = useState<ExpenseVendorRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ExpenseStatus>("");
  const [costCenter, setCostCenter] = useState<"" | ExpenseCostCenter>("");
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
  
  useEffect(() => {
    if (!vendorId) return;

    const stillValid = filteredVendors.some((v) => v.id === vendorId);
    if (!stillValid) setVendorId("");
  }, [vendorId, filteredVendors]);

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
            <MiniBadge label="Categorias" value={String(categories.filter((category) => category.isActive).length)} />
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

          <Field label="Categoria">
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

      <div style={directoryGrid}>
        <div style={{ ...cardStyle, gap: 8 }}>
          <div style={directoryHeader}>
            <div style={directoryHeaderColumn}>
              <div style={sectionTitle}>Categorias</div>
              <div style={sectionCaption}>Clasificacion contable para agrupar y analizar gasto.</div>
            </div>
            <div style={pillCounter}>{activeCategoryCount} activas</div>
          </div>

          {categories.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No hay categorias todavia.</div>
          ) : (
            <div style={directoryListStyle}>
              {categories.map((category) => (
                <div key={category.id} style={directoryRow}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {category.name}
                      {category.code ? ` (${category.code})` : ""}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {category.description || "Sin descripcion"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditCategory(category)}
                    style={ghostBtn}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, gap: 8 }}>
          <div style={directoryHeader}>
            <div style={directoryHeaderColumn}>
              <div style={sectionTitle}>Proveedores</div>
              <div style={sectionCaption}>Base de terceros para trazabilidad y pagos.</div>
            </div>
            <div style={pillCounter}>{activeVendorCount} activos</div>
          </div>

          {vendors.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No hay proveedores todavia.</div>
          ) : (
            <div style={directoryListStyle}>
              {vendors.map((vendor) => (
                <div key={vendor.id} style={directoryRow}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {vendor.name}
                      {vendor.code ? ` (${vendor.code})` : ""}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {vendor.taxId || "Sin NIF/CIF"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditVendor(vendor)}
                    style={ghostBtn}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? <div style={loadingBox}>Cargando gastos...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && !error ? (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Libro de gastos</div>
              <div style={sectionCaption}>Detalle operativo para revisar, pagar y corregir.</div>
            </div>
            <div style={pillCounter}>{rows.length} registros</div>
          </div>

          {rows.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay gastos con esos filtros.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((row) => (
                <div key={row.id} style={itemCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 22 }}>{row.description}</div>
                        <div style={statusBadgeStyle(row.status)}>{expenseStatusLabel(row.status)}</div>
                      </div>

                      {row.status === "PENDING" ? (
                        <div
                          style={{
                            border: "1px solid #fde68a",
                            background: "#fffbeb",
                            color: "#92400e",
                            borderRadius: 10,
                            padding: "6px 8px",
                            fontSize: 12,
                            fontWeight: 900,
                            width: "fit-content",
                          }}
                        >
                          Pendiente de pago
                        </div>
                      ) : null}

                      {["BAR", "OPERATIONS"].includes(String(row.costCenter)) ? (
                        <button
                          type="button"
                          onClick={() => setRestockingExpense(row)}
                          disabled={Boolean(row.barRestock) || row.status === "CANCELED"}
                          style={ghostBtn}
                        >
                          {row.barRestock ? "Stock aplicado" : "Aplicar a stock Bar"}
                        </button>
                      ) : null}

                      <div style={subLine}>
                        Fecha: <b>{fmtDate(row.expenseDate)}</b>
                        {" / "}Categoria: <b>{row.category?.name ?? "-"}</b>
                        {" / "}Centro: <b>{costCenterLabel(row.costCenter)}</b>
                      </div>

                      <div style={subLine}>
                        Proveedor: <b>{row.vendor?.name ?? "-"}</b>
                        {" / "}Metodo: <b>{paymentMethodLabel(row.paymentMethod)}</b>
                      </div>

                      <div style={subLine}>
                        Factura: <b>{row.hasInvoice ? "Si" : "No"}</b>
                        {" / "}IVA: <b>{taxRateLabel(row.taxRateBp)}</b>
                        {" / "}Precio introducido: <b>{row.pricesIncludeTax ? "Con IVA" : "Sin IVA"}</b>
                      </div>

                      <div style={subLine}>
                        Ref: <b>{row.reference ?? "-"}</b>
                        {" / "}Factura: <b>{row.invoiceNumber ?? "-"}</b>
                      </div>

                      <div style={subLine}>
                        Base: <b>{eur(row.amountCents)}</b>
                        {" / "}Impuesto: <b>{eur(row.taxCents)}</b>
                        {" / "}Total: <b>{eur(row.totalCents ?? row.amountCents)}</b>
                      </div>

                      <div style={subLine}>
                        Vence: <b>{fmtDate(row.dueDate)}</b>
                        {" / "}Pagado: <b>{fmtDate(row.paidAt)}</b>
                      </div>

                      {row.note ? (
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                          {row.note}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "start", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => openEditExpense(row)} style={ghostBtn}>
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

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

function getVendorsForCategory(
  vendors: ExpenseVendorRow[],
  categoryId: string
) {
  if (!categoryId) return vendors.filter((v) => v.isActive);

  return vendors.filter((v) =>
    (v.categoryLinks ?? []).some((link) => link.category.id === categoryId)
  );
}

function ExpenseModal({
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

  const availableVendors = useMemo(() => {
    return getVendorsForCategory(vendors, categoryId);
  }, [vendors, categoryId]);

  useEffect(() => {
    if (!vendorId) return;

    const stillValid = availableVendors.some((v) => v.id === vendorId);
    if (!stillValid) setVendorId("");
  }, [vendorId, availableVendors]);

  const computed = useMemo(() => {
    const rawAmount = Number(amountCents || 0);
    const rawTax = Number(taxRateBp || 0);

    if (!hasInvoice) {
      return {
        computedBaseCents: rawAmount,
        computedTaxCents: 0,
        computedTotalCents: rawAmount,
      };
    }

    if (rawTax <= 0) {
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
  const normalizedPaidAt =
      status === "PAID"
        ? (paidAt || expenseDate)
        : (paidAt || null);

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!description.trim()) {
        throw new Error("La descripcion es obligatoria.");
      }

      if (!categoryId) {
        throw new Error("Debes seleccionar una categoria.");
      }

      if (hasInvoice && Number.isNaN(parsedTaxRateBp)) {
        throw new Error("El IVA no es valido.");
      }

      if (hasInvoice && parsedTaxRateBp < 0) {
        throw new Error("El IVA no puede ser negativo.");
      }

      if (!hasInvoice && parsedTaxRateBp !== 0) {
        throw new Error("Si no hay factura, el IVA debe ser 0.");
      }

      if (computed.computedBaseCents < 0 || computed.computedTaxCents < 0 || computed.computedTotalCents < 0) {
        throw new Error("Los importes no pueden ser negativos.");
      }

      if (computed.computedTotalCents < computed.computedBaseCents) {
        throw new Error("El total no puede ser menor que la base.");
      }

      if (status === "PAID" && !paidAt) {
        throw new Error("Si el gasto esta pagado, debes indicar la fecha de pago.");
      }

      if (status === "PAID" && !paymentMethod) {
        throw new Error("Si el gasto esta pagado, indica el metodo de pago.");
      }
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

      const res = await fetch(
        initial ? `/api/admin/expenses/${initial.id}` : "/api/admin/expenses",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando gasto");
    } finally {
      setBusy(false);
    }
  }
    const suggestedReference = useMemo(() => {
        const year = expenseDate ? expenseDate.slice(0, 4) : new Date().getFullYear().toString();
        return `EXP-${shortCostCenter(costCenter)}-${year}-XXXX`;
      }, [expenseDate, costCenter]);

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

        <Field label="Descripcion">
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

        <Field label="Categoria">
          <div style={{ display: "flex", gap: 8 }}>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Selecciona categoria...</option>
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
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            style={inputStyle}
          >
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
          {availableVendors.length} proveedor(es) disponibles para esta categoria
        </div>

        <Field label="Referencia">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            style={inputStyle}
            placeholder={suggestedReference}
          />
        </Field>

        <Field label="Factura">
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Metodo de pago">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "" | ExpensePaymentMethod)}
            style={inputStyle}
          >
            <option value="">-</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {paymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tiene factura?">
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
            <input
              type="checkbox"
              checked={hasInvoice}
              onChange={(e) => setHasInvoice(e.target.checked)}
            />
            <span>Si, con factura</span>
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

        <Field label="Importe introducido">
          <select
            value={entryMode}
            onChange={(e) => setEntryMode(e.target.value as "TOTAL" | "BASE")}
            disabled={!hasInvoice}
            style={inputStyle}
          >
            <option value="TOTAL">Total pagado (con IVA)</option>
            <option value="BASE">Base imponible (sin IVA)</option>
          </select>
        </Field>

        <Field label={entryMode === "TOTAL" ? "Importe total (centimos)" : "Base imponible (centimos)"}>
          <input
            value={amountCents}
            onChange={(e) => setAmountCents(e.target.value)}
            style={inputStyle}
            placeholder="Ej: 12100"
          />
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

      <div
        style={{
          border: "1px solid #dbeafe",
          background: "#eff6ff",
          color: "#1d4ed8",
          borderRadius: 12,
          padding: 10,
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        Usa centimos para evitar errores: 12,10 EUR = 1210.
        Ejemplo con IVA 21%: si introduces 1210 como total, la base sera 1000 y el IVA 210.
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fafafa",
          borderRadius: 12,
          padding: 10,
          display: "grid",
          gap: 4,
          fontSize: 13,
        }}
      >
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

function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ExpenseCategoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }

      const payload = {
        name: normalizeText(name) ?? "",
        code: normalizeText(code) || null,
        description: normalizeText(description) || null,
        isActive,
      };

      const res = await fetch(
        isEdit
          ? `/api/admin/expenses/expense-categories/${initial!.id}`
          : EXPENSE_CATEGORIES_API,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando categoria");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Editar categoria" : "Nueva categoria"} onClose={onClose}>
      <div style={modalGrid2}>
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Codigo">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={inputStyle}
            placeholder="Ej: RECAMBIOS"
          />
        </Field>
      </div>

      <Field label="Descripcion">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      </Field>

      <Field label="Activa">
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Si</span>
        </label>
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}

function VendorModal({
  categories,
  initial,
  onClose,
  onSaved,
}: {
  categories: ExpenseCategoryRow[];
  initial: ExpenseVendorRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    (initial?.categoryLinks ?? []).map((x) => x.category.id)
  );

  const [defaultCategoryId, setDefaultCategoryId] = useState<string>(
    initial?.categoryLinks?.find((x) => x.isDefault)?.category.id ??
      (initial?.categoryLinks?.[0]?.category.id ?? "")
  );

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        const next = prev.filter((id) => id !== categoryId);
        if (defaultCategoryId === categoryId) {
          setDefaultCategoryId(next[0] ?? "");
        }
        return next;
      }

      const next = [...prev, categoryId];
      if (!defaultCategoryId) setDefaultCategoryId(categoryId);
      return next;
    });
  }

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      if (!name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }

      if (selectedCategoryIds.length > 0 && !defaultCategoryId) {
        throw new Error("Debes indicar una categoria por defecto.");
      }

      const payload = {
        name: normalizeText(name) ?? "",
        code: normalizeText(code) || null,
        taxId: normalizeText(taxId) || null,
        email: normalizeText(email) || null,
        phone: normalizeText(phone) || null,
        contactPerson: normalizeText(contactPerson) || null,
        note: normalizeText(note) || null,
        isActive,
        categoryIds: selectedCategoryIds,
        defaultCategoryId: defaultCategoryId || null,
      };

      const res = await fetch(
        isEdit
          ? `/api/admin/expenses/expense-vendors/${initial!.id}`
          : EXPENSE_VENDORS_API,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando proveedor");
    } finally {
      setBusy(false);
    }
  }

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <ModalShell title={isEdit ? "Editar proveedor" : "Nuevo proveedor"} onClose={onClose}>
      <div style={modalGrid2}>
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Codigo">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={inputStyle}
          />
        </Field>

        <Field label="NIF/CIF">
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Telefono">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Contacto">
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fafafa",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900 }}>Categorias asignadas</div>

        {activeCategories.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            No hay categorias activas disponibles.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {activeCategories.map((c) => {
              const checked = selectedCategoryIds.includes(c.id);

              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 10,
                    background: checked ? "#f8fafc" : "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                  />
                  <span>
                    {c.name}
                    {c.code ? ` (${c.code})` : ""}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <Field label="Categoria por defecto">
          <select
            value={defaultCategoryId}
            onChange={(e) => setDefaultCategoryId(e.target.value)}
            style={inputStyle}
            disabled={selectedCategoryIds.length === 0}
          >
            <option value="">-</option>
            {activeCategories
              .filter((c) => selectedCategoryIds.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <Field label="Nota">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={inputStyle} />
      </Field>

      <Field label="Activo">
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Si</span>
        </label>
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 28 }}>{title}</div>
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

function ApplyBarRestockModal({
  expense,
  onClose,
  onSaved,
}: {
  expense: ExpenseRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<BarProductLookup[]>([]);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<BarRestockLine[]>([
    { productId: "", quantity: "1", unitCostEuros: "0" },
  ]);

  function cents(value: string) {
    const n = Number((value ?? "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/admin/bar/products", { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const flat =
      (json.rows ?? []).flatMap((cat: any) =>
        (cat.products ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          unitLabel: p.unitLabel ?? "ud",
          costPriceCents: p.costPriceCents ?? null,
        }))
      ) ?? [];

    setProducts(flat);
  }, []);

  useEffect(() => {
    loadProducts().catch((e) =>
      setError(e instanceof Error ? e.message : "Error cargando productos Bar")
    );
  }, [loadProducts]);

  function updateLine(index: number, patch: Partial<BarRestockLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1", unitCostEuros: "0" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      const items = lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitCostCents: cents(line.unitCostEuros),
      }));

      const res = await fetch(`/api/admin/expenses/${expense.id}/apply-bar-restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || null,
          items,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error aplicando reposición");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Aplicar a stock Bar" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#475569" }}>
          Gasto: <strong>{expense.description}</strong>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional"
          style={inputStyle}
        />

        <div style={{ display: "grid", gap: 10 }}>
          {lines.map((line, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <select
                value={line.productId}
                onChange={(e) => {
                  const productId = e.target.value;
                  const selected = products.find((p) => p.id === productId);
                  updateLine(index, {
                    productId,
                    unitCostEuros:
                      selected?.costPriceCents != null
                        ? (Number(selected.costPriceCents) / 100).toFixed(2)
                        : line.unitCostEuros,
                  });
                }}
                style={inputStyle}
              >
                <option value="">Producto Bar</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
                placeholder="Cantidad"
                style={inputStyle}
              />

              <input
                value={line.unitCostEuros}
                onChange={(e) => updateLine(index, { unitCostEuros: e.target.value })}
                placeholder="Coste unitario €"
                style={inputStyle}
              />

              <button type="button" onClick={() => removeLine(index)} style={ghostBtn}>
                Quitar
              </button>
            </div>
          ))}
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addLine} style={ghostBtn}>
              Añadir línea
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
              {busy ? "Aplicando..." : "Aplicar a stock Bar"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
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

const directoryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const directoryHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const directoryHeaderColumn: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const directoryListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: -2,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
};

const directoryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
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

const pillCounter: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 999,
  background: "#f8fafc",
  padding: "8px 12px",
  fontWeight: 900,
  fontSize: 12,
  color: "#334155",
  height: "fit-content",
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

const itemCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 18,
  padding: 16,
};

const subLine: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
};

const modalGrid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
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

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: "min(1100px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 16,
};
