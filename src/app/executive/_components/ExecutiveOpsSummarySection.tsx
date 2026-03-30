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

type TableRow = {
  nombre: string;
  total: string;
};

export default function ExecutiveOpsSummarySection({
  hrMetrics,
  mechanicsMetrics,
  expensesMetrics,
  operationsCostRows,
}: {
  hrMetrics: MetricItem[];
  mechanicsMetrics: MetricItem[];
  expensesMetrics: MetricItem[];
  operationsCostRows: TableRow[];
}) {
  return (
    <div style={executiveStyles.threeCol}>
      <ExecutiveSection title="RR. HH." subtitle="Horas aprobadas, payroll y prácticas.">
        <div style={executiveStyles.metricsGrid}>
          {hrMetrics.map((metric) => (
            <ExecutiveMetricCard key={metric.title} title={metric.title} value={metric.value} warn={metric.warn} />
          ))}
        </div>
      </ExecutiveSection>

      <ExecutiveSection title="Mecánica" subtitle="Carga abierta, criticidad y coste mensual.">
        <div style={executiveStyles.metricsGrid}>
          {mechanicsMetrics.map((metric) => (
            <ExecutiveMetricCard key={metric.title} title={metric.title} value={metric.value} warn={metric.warn} />
          ))}
        </div>
      </ExecutiveSection>

      <ExecutiveSection title="Gasto operativo" subtitle="Resumen contable del mes y coste operativo base.">
        <div style={executiveStyles.metricsGrid}>
          {expensesMetrics.map((metric) => (
            <ExecutiveMetricCard key={metric.title} title={metric.title} value={metric.value} warn={metric.warn} />
          ))}
        </div>

        <ExecutiveDataTable
          columns={[
            { key: "nombre", label: "Concepto" },
            { key: "total", label: "Importe", align: "right" },
          ]}
          rows={operationsCostRows}
        />
      </ExecutiveSection>
    </div>
  );
}
