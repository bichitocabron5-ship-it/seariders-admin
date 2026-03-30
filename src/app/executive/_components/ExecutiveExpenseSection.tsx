"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ExecutiveChartTooltip,
  ExecutiveDataTable,
  ExecutiveSection,
  executiveStyles,
} from "@/components/executive-ui";

type ChartRow = {
  label: string;
  Total: number;
};

type CostCenterRow = {
  centro: string;
  numero: string;
  total: string;
};

type VendorRow = {
  nombre: string;
  numero: string;
  total: string;
};

function eurCompact(cents: number | null | undefined) {
  if (cents == null) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function ExecutiveExpenseSection({
  expenseCategories,
  costCenterRows,
  vendorRows,
}: {
  expenseCategories: ChartRow[];
  costCenterRows: CostCenterRow[];
  vendorRows: VendorRow[];
}) {
  return (
    <div style={executiveStyles.twoCol}>
      <ExecutiveSection title="Gastos por categoría" subtitle="Top de categorías de gasto del mes.">
        <div style={executiveStyles.chartMedium}>
          <ResponsiveContainer>
            <BarChart data={expenseCategories} layout="vertical" margin={{ left: 8, right: 12 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} />
              <Tooltip content={<ExecutiveChartTooltip formatValue={(_, value) => (typeof value === "number" ? eur(value) : String(value ?? "-"))} />} />
              <Bar dataKey="Total" fill="#dc2626" radius={[0, 10, 10, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ExecutiveSection>

      <ExecutiveSection title="Centros de coste" subtitle="Distribución por área operativa.">
        <ExecutiveDataTable
          columns={[
            { key: "centro", label: "Centro" },
            { key: "numero", label: "N.", align: "right" },
            { key: "total", label: "Total", align: "right" },
          ]}
          rows={costCenterRows}
        />
      </ExecutiveSection>

      <ExecutiveSection title="Proveedores" subtitle="Top de proveedores por importe.">
        <ExecutiveDataTable
          columns={[
            { key: "nombre", label: "Proveedor" },
            { key: "numero", label: "N.", align: "right" },
            { key: "total", label: "Total", align: "right" },
          ]}
          rows={vendorRows}
        />
      </ExecutiveSection>
    </div>
  );
}
