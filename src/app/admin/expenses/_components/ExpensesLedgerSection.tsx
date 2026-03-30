"use client";

import type { CSSProperties } from "react";
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
  taxCents: number | null;
  totalCents: number | null;
  hasInvoice: boolean;
  pricesIncludeTax: boolean;
  taxRateBp: number | null;
  paidAt: string | null;
  dueDate: string | null;
  note: string | null;
  maintenanceEventId: string | null;
  sparePartId: string | null;
  employeeId: string | null;
  createdByUserId: string | null;
  createdByUser: {
    id: string;
    username: string;
    fullName: string;
  } | null;
  category: {
    id: string;
    name: string;
    code: string | null;
  };
  vendor: {
    id: string;
    name: string;
    code: string | null;
    taxId: string | null;
  } | null;
  barRestock?: {
    id: string;
    appliedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export default function ExpensesLedgerSection({
  rows,
  onEditExpense,
  onApplyBarRestock,
  expenseStatusLabel,
  costCenterLabel,
  paymentMethodLabel,
  taxRateLabel,
  eur,
  fmtDate,
  statusBadgeStyle,
}: {
  rows: ExpenseRow[];
  onEditExpense: (row: ExpenseRow) => void;
  onApplyBarRestock: (row: ExpenseRow) => void;
  expenseStatusLabel: (status: ExpenseStatus) => string;
  costCenterLabel: (costCenter: ExpenseCostCenter) => string;
  paymentMethodLabel: (method: ExpensePaymentMethod | null) => string;
  taxRateLabel: (bp: number | null | undefined) => string;
  eur: (cents: number | null | undefined) => string;
  fmtDate: (value: string | null | undefined) => string;
  statusBadgeStyle: (status: ExpenseStatus) => CSSProperties;
}) {
  return (
    <div style={cardStyle}>
      <div style={ledgerHeaderStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={titleStyle}>Libro de gastos</div>
          <div style={sectionCaption}>Detalle operativo para revisar, pagar y corregir.</div>
        </div>
        <div style={pillCounter}>{rows.length} registros</div>
      </div>

      {rows.length === 0 ? (
        <div style={emptyText}>No hay gastos con esos filtros.</div>
      ) : (
        <div style={rowsGridStyle}>
          {rows.map((row) => (
            <div key={row.id} style={itemCard}>
              <div style={itemHeaderStyle}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={titleRowStyle}>
                    <div style={itemTitleStyle}>{row.description}</div>
                    <div style={statusBadgeStyle(row.status)}>{expenseStatusLabel(row.status)}</div>
                  </div>

                  {row.status === "PENDING" ? (
                    <div style={pendingBadgeStyle}>Pendiente de pago</div>
                  ) : null}

                  {["BAR", "OPERATIONS"].includes(String(row.costCenter)) ? (
                    <button
                      type="button"
                      onClick={() => onApplyBarRestock(row)}
                      disabled={Boolean(row.barRestock) || row.status === "CANCELED"}
                      style={ghostBtn}
                    >
                      {row.barRestock ? "Stock aplicado" : "Aplicar a stock Bar"}
                    </button>
                  ) : null}

                  <div style={subLine}>
                    Fecha: <b>{fmtDate(row.expenseDate)}</b>
                    {" / "}Categoría: <b>{row.category?.name ?? "-"}</b>
                    {" / "}Centro: <b>{costCenterLabel(row.costCenter)}</b>
                  </div>

                  <div style={subLine}>
                    Proveedor: <b>{row.vendor?.name ?? "-"}</b>
                    {" / "}Método: <b>{paymentMethodLabel(row.paymentMethod)}</b>
                  </div>

                  <div style={subLine}>
                    Factura: <b>{row.hasInvoice ? "Sí" : "No"}</b>
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

                  {row.note ? <div style={noteStyle}>{row.note}</div> : null}
                </div>

                <div style={actionsWrapStyle}>
                  <button type="button" onClick={() => onEditExpense(row)} style={ghostBtn}>
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  ...opsStyles.sectionCard,
};

const ledgerHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
};

const sectionCaption: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const pillCounter: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 999,
  background: "#f8fafc",
  padding: "8px 12px",
  fontWeight: 900,
  fontSize: 12,
  color: "#334155",
  height: "fit-content",
};

const emptyText: CSSProperties = {
  opacity: 0.7,
};

const rowsGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const itemCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  background: "#fff",
  borderRadius: 18,
  padding: 16,
};

const itemHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const itemTitleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 22,
};

const pendingBadgeStyle: CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 10,
  padding: "6px 8px",
  fontSize: 12,
  fontWeight: 900,
  width: "fit-content",
};

const subLine: CSSProperties = {
  fontSize: 13,
  color: "#475569",
};

const noteStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.9,
};

const actionsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "start",
  flexWrap: "wrap",
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
};
