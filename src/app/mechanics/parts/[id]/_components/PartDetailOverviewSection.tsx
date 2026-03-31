"use client";

import type React from "react";

type PartDetail = {
  name: string;
  sku: string | null;
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
};

type Summary = {
  totalIn: number;
  totalOut: number;
  movementsCount: number;
  totalMovementCostCents: number;
} | null;

type MaintenanceUsageSummary = {
  totalQty: number;
  totalCostCents: number;
  count: number;
} | null;

export default function PartDetailOverviewSection({
  row,
  lowStock,
  stockStateLabel,
  summary,
  maintenanceUsageSummary,
  eur,
  cardStyle,
}: {
  row: PartDetail;
  lowStock: boolean;
  stockStateLabel: string;
  summary: Summary;
  maintenanceUsageSummary: MaintenanceUsageSummary;
  eur: (cents: number | null) => string;
  cardStyle: React.CSSProperties;
}) {
  return (
    <>
      <div
        style={{
          ...cardStyle,
          border: lowStock ? "1px solid #fde68a" : "1px solid #dbe4ea",
          background: lowStock ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff",
          padding: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>{row.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {row.sku ? `SKU ${row.sku}` : "Sin SKU"}
              {row.category ? ` · ${row.category}` : ""}
              {row.brand ? ` · ${row.brand}` : ""}
              {row.model ? ` · ${row.model}` : ""}
              {row.unit ? ` · ${row.unit}` : ""}
            </div>
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 12,
              border: lowStock ? "1px solid #fde68a" : "1px solid #bbf7d0",
              background: lowStock ? "#fffbeb" : "#f0fdf4",
              color: lowStock ? "#92400e" : "#166534",
            }}
          >
            {stockStateLabel}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Proveedor: <b>{row.supplierName ?? "—"}</b>
          {row.note ? ` · Nota: ${row.note}` : ""}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Stock actual" value={row.stockQty} danger={lowStock} />
        <Kpi title="Stock mínimo" value={row.minStockQty} />
        <Kpi title="Coste unitario" value={eur(row.costPerUnitCents)} />
        <Kpi title="Entradas acumuladas" value={summary?.totalIn ?? 0} />
        <Kpi title="Salidas acumuladas" value={summary?.totalOut ?? 0} />
        <Kpi title="Movimientos" value={summary?.movementsCount ?? 0} />
        <Kpi title="Usos en mantenimiento" value={maintenanceUsageSummary?.count ?? 0} />
        <Kpi title="Activo" value={row.isActive ? "Sí" : "No"} />
      </div>
    </>
  );
}

function Kpi({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        border: danger ? "1px solid #fde68a" : "1px solid #e5e7eb",
        background: danger ? "#fffbeb" : "#fff",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 20 }}>{value}</div>
    </div>
  );
}
