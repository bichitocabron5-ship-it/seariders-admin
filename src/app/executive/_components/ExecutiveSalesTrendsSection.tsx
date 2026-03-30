"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ExecutiveChartTooltip,
  ExecutiveMetricCard,
  ExecutiveSection,
  executiveStyles,
} from "@/components/executive-ui";

type SalesRow = {
  label: string;
  Ventas: number;
  Cobrado: number;
  Reservas: number;
};

type MonthRow = {
  label: string;
  Ventas: number;
  Payroll: number;
  Mantenimiento: number;
  Margen: number;
};

type TodayMetrics = {
  sales: string;
  collected: string;
  pending: string;
  reservations: string;
  pendingWarn: boolean;
};

function eurCompact(cents: number | null | undefined) {
  if (cents == null) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtInt(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("es-ES").format(value);
}

export default function ExecutiveSalesTrendsSection({
  sales7d,
  sales30d,
  months6,
  todayMetrics,
}: {
  sales7d: SalesRow[];
  sales30d: SalesRow[];
  months6: MonthRow[];
  todayMetrics: TodayMetrics;
}) {
  return (
    <>
      <ExecutiveSection title="Pulso comercial" subtitle="Ventas, cobro y reservas en los últimos 7 días.">
        <div style={executiveStyles.chartLarge}>
          <ResponsiveContainer>
            <ComposedChart data={sales7d}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis yAxisId="eur" tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} width={88} />
              <YAxis yAxisId="count" orientation="right" tickFormatter={(value) => fmtInt(value)} tickLine={false} axisLine={false} width={42} />
              <Tooltip
                content={
                  <ExecutiveChartTooltip
                    formatValue={(name, value) =>
                      typeof value === "number"
                        ? ["Ventas", "Cobrado", "Payroll", "Mantenimiento", "Margen", "Total"].includes(name)
                          ? eurCompact(value)
                          : fmtInt(value)
                        : String(value ?? "-")
                    }
                  />
                }
              />
              <Legend />
              <Area yAxisId="eur" dataKey="Ventas" stroke="#0f766e" fill="url(#salesGradient)" strokeWidth={3} />
              <Line yAxisId="eur" dataKey="Cobrado" stroke="#0f172a" strokeWidth={2.5} dot={false} />
              <Bar yAxisId="count" dataKey="Reservas" fill="#d97706" radius={[8, 8, 0, 0]} maxBarSize={26} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={executiveStyles.metricsGrid}>
          <ExecutiveMetricCard title="Ventas hoy" value={todayMetrics.sales} />
          <ExecutiveMetricCard title="Cobrado hoy" value={todayMetrics.collected} />
          <ExecutiveMetricCard title="Pendiente hoy" value={todayMetrics.pending} warn={todayMetrics.pendingWarn} />
          <ExecutiveMetricCard title="Reservas hoy" value={todayMetrics.reservations} />
        </div>
      </ExecutiveSection>

      <div style={executiveStyles.twoCol}>
        <ExecutiveSection title="Tendencia 30 dias" subtitle="Ritmo comercial reciente con ventas, cobro y reservas.">
          <div style={executiveStyles.chartMedium}>
            <ResponsiveContainer>
              <ComposedChart data={sales30d}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis yAxisId="eur" tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} width={88} />
                <YAxis yAxisId="count" orientation="right" tickFormatter={(value) => fmtInt(value)} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  content={
                    <ExecutiveChartTooltip
                      formatValue={(name, value) =>
                        typeof value === "number"
                          ? ["Ventas", "Cobrado", "Payroll", "Mantenimiento", "Margen", "Total"].includes(name)
                            ? eurCompact(value)
                            : fmtInt(value)
                          : String(value ?? "-")
                      }
                    />
                  }
                />
                <Legend />
                <Bar yAxisId="eur" dataKey="Ventas" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={18} />
                <Line yAxisId="eur" dataKey="Cobrado" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                <Line yAxisId="count" dataKey="Reservas" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ExecutiveSection>

        <ExecutiveSection title="Margen y costes" subtitle="Ventas, payroll, mantenimiento y margen en 6 meses.">
          <div style={executiveStyles.chartMedium}>
            <ResponsiveContainer>
              <BarChart data={months6}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} width={88} />
                <Tooltip
                  content={
                    <ExecutiveChartTooltip
                      formatValue={(name, value) =>
                        typeof value === "number"
                          ? ["Ventas", "Cobrado", "Payroll", "Mantenimiento", "Margen", "Total"].includes(name)
                            ? eurCompact(value)
                            : fmtInt(value)
                          : String(value ?? "-")
                      }
                    />
                  }
                />
                <Legend />
                <Bar dataKey="Ventas" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Payroll" fill="#0f172a" radius={[8, 8, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Mantenimiento" fill="#dc2626" radius={[8, 8, 0, 0]} maxBarSize={24} />
                <Line dataKey="Margen" stroke="#d97706" strokeWidth={3} dot={{ r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExecutiveSection>
      </div>
    </>
  );
}
