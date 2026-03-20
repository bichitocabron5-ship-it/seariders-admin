// src/app/mechanics/parts/_components/history.tsx
export type HistoryResponse = {
  ok: true;
  part: {
    id: string;
    sku: string | null;
    name: string;
    category: string | null;
    brand: string | null;
    model: string | null;
    unit: string | null;
    stockQty: number;
    minStockQty: number;
    costPerUnitCents: number | null;
    supplierName: string | null;
    note: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    count: number;
    inQty: number;
    outQty: number;
    totalCostCents: number;
  };
  movements: Array<{
    id: string;
    type: string;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    note: string | null;
    createdAt: string;
    vendor: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    expense: {
      id: string;
      status: string;
      amountCents: number | null;
      taxCents: number | null;
      totalCents: number | null;
      expenseDate: string;
    } | null;
    maintenanceEvent: {
      id: string;
      entityType: string;
      jetskiId: string | null;
      assetId: string | null;
      type: string;
      status: string;
      severity: string | null;
      createdAt: string;
    } | null;
    createdByUser: {
      id: string;
      username: string | null;
      fullName: string | null;
    } | null;
  }>;
};

export function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toFixed(2)} EUR`;
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

export function movementTypeLabel(type: string) {
  switch (type) {
    case "PURCHASE":
      return "Compra";
    case "CONSUMPTION":
      return "Consumo";
    case "ADJUSTMENT_IN":
      return "Ajuste +";
    case "ADJUSTMENT_OUT":
      return "Ajuste -";
    case "INITIAL_STOCK":
      return "Stock inicial";
    case "RETURN":
      return "Devolución";
    default:
      return type;
  }
}

export function movementBadgeStyle(type: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (
    type === "PURCHASE" ||
    type === "ADJUSTMENT_IN" ||
    type === "INITIAL_STOCK" ||
    type === "RETURN"
  ) {
    return {
      ...base,
      borderColor: "#bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }

  if (type === "CONSUMPTION" || type === "ADJUSTMENT_OUT") {
    return {
      ...base,
      borderColor: "#fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
    };
  }

  return base;
}
