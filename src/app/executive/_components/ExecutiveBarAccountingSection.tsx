"use client";

import {
  ExecutiveDataTable,
  ExecutiveMetricCard,
  ExecutiveSection,
  executiveStyles,
} from "@/components/executive-ui";

type MetricItem = {
  title: string;
  value: string;
  warn?: boolean;
};

type CategoryRow = {
  categoria: string;
  compras: string;
  total: string;
};

type VendorRow = {
  proveedor: string;
  compras: string;
  total: string;
};

type MarginRow = {
  producto: string;
  categoria: string;
  ventas: string;
  coste: string;
  margen: string;
  tickets: string;
};

export default function ExecutiveBarAccountingSection({
  metrics,
  categoryRows,
  vendorRows,
  marginRows,
}: {
  metrics: MetricItem[];
  categoryRows: CategoryRow[];
  vendorRows: VendorRow[];
  marginRows: MarginRow[];
}) {
  return (
    <ExecutiveSection title="Contabilidad Bar" subtitle="Ventas, compras y margen operativo aproximado del mes.">
      <div style={executiveStyles.metricsGrid}>
        {metrics.map((metric) => (
          <ExecutiveMetricCard key={metric.title} title={metric.title} value={metric.value} warn={metric.warn} />
        ))}
      </div>

      <div style={executiveStyles.twoCol}>
        <ExecutiveDataTable
          columns={[
            { key: "categoria", label: "Categoría" },
            { key: "compras", label: "Compras", align: "right" },
            { key: "total", label: "Total", align: "right" },
          ]}
          rows={categoryRows}
        />

        <ExecutiveDataTable
          columns={[
            { key: "proveedor", label: "Proveedor" },
            { key: "compras", label: "Compras", align: "right" },
            { key: "total", label: "Total", align: "right" },
          ]}
          rows={vendorRows}
        />

        <ExecutiveDataTable
          columns={[
            { key: "producto", label: "Producto" },
            { key: "categoria", label: "Categoría" },
            { key: "ventas", label: "Ventas", align: "right" },
            { key: "coste", label: "Coste", align: "right" },
            { key: "margen", label: "Margen", align: "right" },
            { key: "tickets", label: "Tickets", align: "right" },
          ]}
          rows={marginRows}
        />
      </div>
    </ExecutiveSection>
  );
}
