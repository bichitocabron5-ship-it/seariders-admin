// src/app/executive/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ExecutiveResponse = {
  ok: true;
  ranges: {
    today: { start: string; endExclusive: string };
    week: { start: string; endExclusive: string };
    month: { start: string; endExclusive: string };
  };
  kpis: {
    today: {
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
      reservations: number;
    };
    week: {
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
      reservations: number;
      averageTicketCents: number;
    };
    month: {
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
      reservations: number;
      averageTicketCents: number;
      estimatedMarginCents: number;
      cashMarginCents: number;
    };
  };
  expenses: {
    monthTotalCents: number;
    monthPaidCents: number;
    monthPendingCents: number;
    monthCount: number;
    byCategory: Array<{ category: string; count: number; totalCents: number }>;
    byCostCenter: Array<{ costCenter: string; count: number; totalCents: number }>;
    byVendor: Array<{ vendor: string; count: number; totalCents: number }>;
  };
  health: {
    inSea: number;
    ready: number;
    unformalized: number;
    criticalPayments: number;
    incidentsOpen: number;
    openWorklogs: number;
    maintenanceOpen: number;
    maintenanceCritical: number;
  };
  channels: Array<{
    channel: string;
    reservations: number;
    salesCents: number;
    collectedCents: number;
    pendingCents: number;
    averageTicketCents: number;
  }>;
  marketing: Array<{
    source: string;
    reservations: number;
    salesCents: number;
    collectedCents: number;
    pendingCents: number;
    averageTicketCents: number;
  }>;
  services: Array<{
    service: string;
    reservations: number;
    quantity: number;
    salesCents: number;
    collectedCents: number;
    pendingCents: number;
    averageTicketCents: number;
  }>;
  hr: {
    approvedMinutesToday: number;
    approvedMinutesWeek: number;
    approvedMinutesMonth: number;
    pendingPayrollCents: number;
    monthPayrollCents: number;
    activeInterns: number;
    internshipLowBalance: number;
  };
  mechanics: {
    openEvents: number;
    criticalEvents: number;
    monthCostCents: number;
    monthPartsCostCents: number;
    monthLaborCostCents: number;
    lowStockParts: number;
  };
  cash: {
    collectedTodayCents: number;
    pendingTodayCents: number;
    depositsHeldCents: number;
    depositsLiberableCents: number;
    reservationsWithDebt: number;
  };
  trends: {
    days7: Array<{
      date: string;
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
      reservations: number;
      approvedMinutes: number;
    }>;
    days30: Array<{
      date: string;
      salesCents: number;
      collectedCents: number;
      pendingCents: number;
      reservations: number;
      approvedMinutes: number;
    }>;
    months6: Array<{
      month: string;
      salesCents: number;
      payrollCents: number;
      maintenanceCents: number;
      estimatedMarginCents: number;
      maintenanceEvents: number;
    }>;
  };
  bar: {
    todayStaffSalesCents: number;
    todaySalesCents: number;
    monthSalesCents: number;
    lowStockCount: number;
  };
  assets: {
    summary: Record<string, Record<string, number>>;
    incidentsOpen: number;
  };
  fulfillment: {
    pending: number;
    deliveredNotReturned: number;
  };
  cashByOrigin: Array<{
    origin: string;
    collectedTodayCents: number;
  }>;
  barAccounting: {
    monthRegularSalesCents: number;
    monthStaffSalesCents: number;
    monthSalesCents: number;
    monthPurchasesCents: number;
    monthPurchasesPaidCents: number;
    monthPurchasesPendingCents: number;
    marginApproxCents: number;
    marginRealCents: number;
    costTheoreticalCents: number;
    topMarginProducts: Array<{
      product: string;
      category: string;
      salesCents: number;
      costCents: number;
      marginCents: number;
      tickets: number;
    }>;
    topVendors: Array<{
      vendor: string;
      count: number;
      totalCents: number;
    }>;
    byCategory: Array<{
      category: string;
      count: number;
      totalCents: number;
    }>;
  };
};

const money0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ints = new Intl.NumberFormat("es-ES");

function fixText(value: string | null | undefined, fallback = "-") {
  if (!value) return fallback;
  let normalized = value;

  if (/[ÃÂâ]/.test(normalized)) {
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

function eur(cents: number | null | undefined) {
  if (cents == null) return "-";
  return money2.format(cents / 100);
}

function eurCompact(cents: number | null | undefined) {
  if (cents == null) return "-";
  return money0.format(cents / 100);
}

function fmtInt(value: number | null | undefined) {
  if (value == null) return "-";
  return ints.format(value);
}

function fmtMinutes(total: number | null | undefined) {
  if (total == null) return "-";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${m} min`;
}

function shortDateLabel(value: string) {
  if (!value) return "";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return value;
  }
}

function shortMonthLabel(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}

function shortDateTimeLabel(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rangeLabel(start: string, endExclusive: string) {
  const startDate = new Date(start);
  const endDate = new Date(endExclusive);
  const inclusiveEnd = new Date(endDate.getTime() - 1);

  return `${startDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  })} - ${inclusiveEnd.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  })}`;
}

function costCenterLabel(value: string) {
  switch (value) {
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
      return "RR. HH.";
    case "MECHANICS":
      return "Mecánica";
    case "OPERATIONS":
      return "Operativa";
    case "MARKETING":
      return "Marketing";
    case "PORT":
      return "Puerto";
    default:
      return fixText(value, "-");
  }
}

function originLabel(value: string) {
  switch (value) {
    case "STORE":
      return "Tienda";
    case "BOOTH":
      return "Carpa";
    case "BAR":
      return "Bar";
    default:
      return fixText(value, "-");
  }
}

function assetTypeLabel(value: string) {
  switch (value) {
    case "GOPRO":
      return "GoPro";
    case "WETSUIT":
      return "Neoprenos";
    case "OTHER":
      return "Otros";
    default:
      return fixText(value, "-");
  }
}

export default function ExecutivePage() {
  const [data, setData] = useState<ExecutiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/executive/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as ExecutiveResponse);
      setRefreshedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando el dashboard operativo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sales7d = useMemo(
    () =>
      data?.trends.days7.map((row) => ({
        label: shortDateLabel(row.date),
        Ventas: row.salesCents,
        Cobrado: row.collectedCents,
        Reservas: row.reservations,
      })) ?? [],
    [data]
  );

  const sales30d = useMemo(
    () =>
      data?.trends.days30.map((row) => ({
        label: shortDateLabel(row.date),
        Ventas: row.salesCents,
        Cobrado: row.collectedCents,
        Reservas: row.reservations,
      })) ?? [],
    [data]
  );

  const months6 = useMemo(
    () =>
      data?.trends.months6.map((row) => ({
        label: shortMonthLabel(row.month),
        Ventas: row.salesCents,
        Payroll: row.payrollCents,
        Mantenimiento: row.maintenanceCents,
        Margen: row.estimatedMarginCents,
      })) ?? [],
    [data]
  );

  const expenseCategories = useMemo(
    () =>
      data?.expenses.byCategory.slice(0, 8).map((row) => ({
        label: fixText(row.category, "Sin categoría"),
        Total: row.totalCents,
      })) ?? [],
    [data]
  );

  const rangeCards = useMemo(
    () =>
      data
        ? [
            { label: "Hoy", value: rangeLabel(data.ranges.today.start, data.ranges.today.endExclusive) },
            { label: "Semana", value: rangeLabel(data.ranges.week.start, data.ranges.week.endExclusive) },
            { label: "Mes", value: rangeLabel(data.ranges.month.start, data.ranges.month.endExclusive) },
            { label: "Actualizado", value: shortDateTimeLabel(refreshedAt) },
          ]
        : [],
    [data, refreshedAt]
  );

  const executiveBrief = useMemo(
    () =>
      data
        ? [
            {
              title: "Liquidez",
              value: eur(data.kpis.month.collectedCents),
              detail: `Pendiente ${eur(data.kpis.month.pendingCents)} · Depósitos ${eur(data.cash.depositsHeldCents)}`,
              warn: data.kpis.month.pendingCents > 0,
            },
            {
              title: "Operación",
              value: `${fmtInt(data.health.ready)} ready / ${fmtInt(data.health.inSea)} en mar`,
              detail: `${fmtInt(data.health.criticalPayments)} cobros críticos · ${fmtInt(data.health.maintenanceOpen)} mantenimientos abiertos`,
              warn: data.health.criticalPayments > 0 || data.health.maintenanceOpen > 0,
            },
            {
              title: "Bar",
              value: eur(data.barAccounting.marginRealCents),
              detail: `Ventas ${eur(data.bar.monthSalesCents)} · Compras ${eur(data.barAccounting.monthPurchasesCents)}`,
              warn: data.barAccounting.marginRealCents < 0 || data.bar.lowStockCount > 0,
            },
          ]
        : [],
    [data]
  );

  const cashOriginRows = useMemo(
    () =>
      data?.cashByOrigin.map((row) => ({
        origen: originLabel(row.origin),
        total: eur(row.collectedTodayCents),
      })) ?? [],
    [data]
  );

  const assetRows = useMemo(() => {
    if (!data?.assets?.summary) return [];

    return Object.entries(data.assets.summary).map(([type, summary]) => ({
      tipo: assetTypeLabel(type),
      disponibles: fmtInt(summary.AVAILABLE ?? 0),
      entregados: fmtInt(summary.DELIVERED ?? 0),
      mantenimiento: fmtInt(summary.MAINTENANCE ?? 0),
      dañados: fmtInt(summary.DAMAGED ?? 0),
      perdidos: fmtInt(summary.LOST ?? 0),
    }));
  }, [data]);

  const operationsCostRows = useMemo(
    () => [
      { nombre: "Payroll mes", total: eur(data?.hr.monthPayrollCents) },
      { nombre: "Mecánica mes", total: eur(data?.mechanics.monthCostCents) },
      { nombre: "Gastos pagados mes", total: eur(data?.expenses.monthPaidCents) },
      { nombre: "Gastos pendientes mes", total: eur(data?.expenses.monthPendingCents) },
      { nombre: "Ventas Bar mes", total: eur(data?.bar.monthSalesCents) },
    ],
    [data]
  );

  const barVendorRows = useMemo(
    () =>
      data?.barAccounting.topVendors.map((row) => ({
        proveedor: fixText(row.vendor, "-"),
        compras: fmtInt(row.count),
        total: eur(row.totalCents),
      })) ?? [],
    [data]
  );

  const barCategoryRows = useMemo(
    () =>
      data?.barAccounting.byCategory.map((row) => ({
        categoria: fixText(row.category, "-"),
        compras: fmtInt(row.count),
        total: eur(row.totalCents),
      })) ?? [],
    [data]
  );

  const barMarginProductRows = useMemo(
    () =>
      data?.barAccounting.topMarginProducts.map((row) => ({
        producto: fixText(row.product, "-"),
        categoria: fixText(row.category, "-"),
        ventas: eur(row.salesCents),
        coste: eur(row.costCents),
        margen: eur(row.marginCents),
        tickets: fmtInt(row.tickets),
      })) ?? [],
    [data]
  );

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Panel ejecutivo</div>
          <h1 style={titleStyle}>Contabilidad y Operaciones</h1>
          <p style={subtitleStyle}>
            Seguimiento de negocio, caja, operativa, RR. HH. y mantenimiento con métricas más legibles y una vista ejecutiva más limpia.
          </p>
          {rangeCards.length > 0 ? (
            <div style={metaGrid}>
              {rangeCards.map((item) => (
                <MetaBadge key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          ) : null}
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={load} style={primaryBtn}>
            Refrescar
          </button>
          <Link href="/admin" style={ghostBtn}>Admin</Link>
          <Link href="/operations" style={ghostBtn}>Operaciones</Link>
          <Link href="/hr" style={ghostBtn}>RR. HH.</Link>
          <Link href="/mechanics" style={ghostBtn}>Mecánica</Link>
          <Link href="/admin/expenses" style={ghostBtn}>Gastos</Link>
        </div>
      </section>

      {loading ? <div style={infoBox}>Cargando dashboard...</div> : null}
      {error ? <div style={errorBox}>{fixText(error, "Error")}</div> : null}

      {!loading && data ? (
        <>
          <div style={heroStatsGrid}>
            <HeroStat label="Ventas mes" value={eur(data.kpis.month.salesCents)} detail={`${fmtInt(data.kpis.month.reservations)} reservas`} />
            <HeroStat label="Cobrado mes" value={eur(data.kpis.month.collectedCents)} detail={`Pendiente ${eur(data.kpis.month.pendingCents)}`} />
            <HeroStat label="Margen estimado" value={eur(data.kpis.month.estimatedMarginCents)} detail={`Caja ${eur(data.kpis.month.cashMarginCents)}`} danger={data.kpis.month.estimatedMarginCents < 0} />
            <HeroStat label="Ticket medio" value={eur(data.kpis.month.averageTicketCents)} detail={`Semana ${eur(data.kpis.week.averageTicketCents)}`} />
          </div>

          <div style={briefGrid}>
            {executiveBrief.map((item) => (
              <BriefCard
                key={item.title}
                title={item.title}
                value={item.value}
                detail={item.detail}
                warn={item.warn}
              />
            ))}
          </div>

          <Section title="Pulso comercial" subtitle="Ventas, cobro y reservas en los últimos 7 días.">
            <div style={chartLarge}>
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
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Area yAxisId="eur" dataKey="Ventas" stroke="#0f766e" fill="url(#salesGradient)" strokeWidth={3} />
                  <Line yAxisId="eur" dataKey="Cobrado" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                  <Bar yAxisId="count" dataKey="Reservas" fill="#d97706" radius={[8, 8, 0, 0]} maxBarSize={26} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={metricsGrid}>
              <MetricCard title="Ventas hoy" value={eur(data.kpis.today.salesCents)} />
              <MetricCard title="Cobrado hoy" value={eur(data.kpis.today.collectedCents)} />
              <MetricCard title="Pendiente hoy" value={eur(data.kpis.today.pendingCents)} warn={data.kpis.today.pendingCents > 0} />
              <MetricCard title="Reservas hoy" value={fmtInt(data.kpis.today.reservations)} />
            </div>
          </Section>

          <div style={twoCol}>
            <Section title="Tendencia 30 dias" subtitle="Ritmo comercial reciente con ventas, cobro y reservas.">
              <div style={chartMedium}>
                <ResponsiveContainer>
                  <ComposedChart data={sales30d}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis yAxisId="eur" tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} width={88} />
                    <YAxis yAxisId="count" orientation="right" tickFormatter={(value) => fmtInt(value)} tickLine={false} axisLine={false} width={42} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar yAxisId="eur" dataKey="Ventas" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={18} />
                    <Line yAxisId="eur" dataKey="Cobrado" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="count" dataKey="Reservas" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Margen y costes" subtitle="Ventas, payroll, mantenimiento y margen en 6 meses.">
              <div style={chartMedium}>
                <ResponsiveContainer>
                  <BarChart data={months6}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} width={88} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="Ventas" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="Payroll" fill="#0f172a" radius={[8, 8, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="Mantenimiento" fill="#dc2626" radius={[8, 8, 0, 0]} maxBarSize={24} />
                    <Line dataKey="Margen" stroke="#d97706" strokeWidth={3} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <div style={twoCol}>
            <Section title="Salud operativa" subtitle="Estado actual y alertas activas.">
              <div style={metricsGrid}>
                <MetricCard title="Ready" value={fmtInt(data.health.ready)} />
                <MetricCard title="En mar" value={fmtInt(data.health.inSea)} />
                <MetricCard title="Sin formalizar" value={fmtInt(data.health.unformalized)} warn={data.health.unformalized > 0} />
                <MetricCard title="Cobros críticos" value={fmtInt(data.health.criticalPayments)} warn={data.health.criticalPayments > 0} />
                <MetricCard title="Jornadas abiertas" value={fmtInt(data.health.openWorklogs)} warn={data.health.openWorklogs > 0} />
                <MetricCard title="Incidencias abiertas" value={fmtInt(data.health.incidentsOpen)} warn={data.health.incidentsOpen > 0} />
                <MetricCard title="Mantenimiento abierto" value={fmtInt(data.health.maintenanceOpen)} warn={data.health.maintenanceOpen > 0} />
                <MetricCard title="Mantenimiento critico" value={fmtInt(data.health.maintenanceCritical)} warn={data.health.maintenanceCritical > 0} />
              </div>
            </Section>

            <Section title="Caja y deuda" subtitle="Cobro del día, depósitos y reservas con riesgo.">
              <div style={metricsGrid}>
                <MetricCard title="Cobrado hoy" value={eur(data.cash.collectedTodayCents)} />
                <MetricCard title="Pendiente hoy" value={eur(data.cash.pendingTodayCents)} warn={data.cash.pendingTodayCents > 0} />
                <MetricCard title="Depósitos retenidos" value={eur(data.cash.depositsHeldCents)} />
                <MetricCard title="Depósitos liberables" value={eur(data.cash.depositsLiberableCents)} />
                <MetricCard title="Reservas con deuda" value={fmtInt(data.cash.reservationsWithDebt)} warn={data.cash.reservationsWithDebt > 0} />
              </div>
            </Section>
          </div>

          <div style={twoCol}>
            <Section title="Bar y retail" subtitle="Ventas y presión operativa del módulo Bar.">
              <div style={metricsGrid}>
                <MetricCard title="Ventas Bar hoy" value={eur(data.bar.todaySalesCents)} />
                <MetricCard title="Staff hoy" value={eur(data.bar.todayStaffSalesCents)} />
                <MetricCard title="Ventas Bar mes" value={eur(data.bar.monthSalesCents)} />
                <MetricCard title="Stock bajo Bar" value={fmtInt(data.bar.lowStockCount)} warn={data.bar.lowStockCount > 0} />
              </div>
            </Section>

            <Section title="Fulfillment y reutilizables" subtitle="Entrega, devolución e incidencias de equipos.">
              <div style={metricsGrid}>
                <MetricCard title="Pendientes de entrega" value={fmtInt(data.fulfillment.pending)} warn={data.fulfillment.pending > 0} />
                <MetricCard title="Entregado no devuelto" value={fmtInt(data.fulfillment.deliveredNotReturned)} warn={data.fulfillment.deliveredNotReturned > 0} />
                <MetricCard title="Incidencias assets" value={fmtInt(data.assets.incidentsOpen)} warn={data.assets.incidentsOpen > 0} />
              </div>

              <DataTable
                columns={[
                  { key: "tipo", label: "Tipo" },
                  { key: "disponibles", label: "Disponibles", align: "right" },
                  { key: "entregados", label: "Entregados", align: "right" },
                  { key: "mantenimiento", label: "Mantenimiento", align: "right" },
                  { key: "dañados", label: "Dañados", align: "right" },
                  { key: "perdidos", label: "Perdidos", align: "right" },
                ]}
                rows={assetRows}
              />
            </Section>
          </div>

          <Section title="Contabilidad Bar" subtitle="Ventas, compras y margen operativo aproximado del mes.">
            <div style={metricsGrid}>
              <MetricCard title="Ventas mes" value={eur(data.barAccounting.monthSalesCents)} />
              <MetricCard title="Ventas normales" value={eur(data.barAccounting.monthRegularSalesCents)} />
              <MetricCard title="Ventas staff" value={eur(data.barAccounting.monthStaffSalesCents)} />
              <MetricCard title="Compras mes" value={eur(data.barAccounting.monthPurchasesCents)} />
              <MetricCard title="Compras pagadas" value={eur(data.barAccounting.monthPurchasesPaidCents)} />
              <MetricCard title="Compras pendientes" value={eur(data.barAccounting.monthPurchasesPendingCents)} warn={data.barAccounting.monthPurchasesPendingCents > 0} />
              <MetricCard title="Coste teórico ventas" value={eur(data.barAccounting.costTheoreticalCents)} />
              <MetricCard title="Margen aprox." value={eur(data.barAccounting.marginApproxCents)} warn={data.barAccounting.marginApproxCents < 0} />
              <MetricCard title="Margen bruto real" value={eur(data.barAccounting.marginRealCents)} warn={data.barAccounting.marginRealCents < 0} />
            </div>

            <div style={twoCol}>
              <DataTable
                columns={[
                  { key: "categoria", label: "Categoría" },
                  { key: "compras", label: "Compras", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={barCategoryRows}
              />

              <DataTable
                columns={[
                  { key: "proveedor", label: "Proveedor" },
                  { key: "compras", label: "Compras", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={barVendorRows}
              />

              <DataTable
                columns={[
                  { key: "producto", label: "Producto" },
                  { key: "categoria", label: "Categoría" },
                  { key: "ventas", label: "Ventas", align: "right" },
                  { key: "coste", label: "Coste", align: "right" },
                  { key: "margen", label: "Margen", align: "right" },
                  { key: "tickets", label: "Tickets", align: "right" },
                ]}
                rows={barMarginProductRows}
              />
            </div>
          </Section>

          <div style={threeCol}>
            <Section title="RR. HH." subtitle="Horas aprobadas, payroll y prácticas.">
              <div style={metricsGrid}>
                <MetricCard title="Hoy" value={fmtMinutes(data.hr.approvedMinutesToday)} />
                <MetricCard title="Semana" value={fmtMinutes(data.hr.approvedMinutesWeek)} />
                <MetricCard title="Mes" value={fmtMinutes(data.hr.approvedMinutesMonth)} />
                <MetricCard title="Payroll pendiente" value={eur(data.hr.pendingPayrollCents)} warn={data.hr.pendingPayrollCents > 0} />
                <MetricCard title="Coste del mes" value={eur(data.hr.monthPayrollCents)} />
                <MetricCard title="Prácticas activas" value={fmtInt(data.hr.activeInterns)} />
                <MetricCard title="Bolsa baja" value={fmtInt(data.hr.internshipLowBalance)} warn={data.hr.internshipLowBalance > 0} />
              </div>
            </Section>

            <Section title="Mecánica" subtitle="Carga abierta, criticidad y coste mensual.">
              <div style={metricsGrid}>
                <MetricCard title="Eventos abiertos" value={fmtInt(data.mechanics.openEvents)} warn={data.mechanics.openEvents > 0} />
                <MetricCard title="Eventos criticos" value={fmtInt(data.mechanics.criticalEvents)} warn={data.mechanics.criticalEvents > 0} />
                <MetricCard title="Coste total" value={eur(data.mechanics.monthCostCents)} />
                <MetricCard title="Piezas" value={eur(data.mechanics.monthPartsCostCents)} />
                <MetricCard title="Mano de obra" value={eur(data.mechanics.monthLaborCostCents)} />
                <MetricCard title="Stock bajo" value={fmtInt(data.mechanics.lowStockParts)} warn={data.mechanics.lowStockParts > 0} />
              </div>
            </Section>

            <Section title="Gasto operativo" subtitle="Resumen contable del mes y coste operativo base.">
              <div style={metricsGrid}>
                <MetricCard title="Total mes" value={eur(data.expenses.monthTotalCents)} />
                <MetricCard title="Pagado" value={eur(data.expenses.monthPaidCents)} />
                <MetricCard title="Pendiente" value={eur(data.expenses.monthPendingCents)} warn={data.expenses.monthPendingCents > 0} />
                <MetricCard title="Número de gastos" value={fmtInt(data.expenses.monthCount)} />
                <MetricCard title="Margen estimado" value={eur(data.kpis.month.estimatedMarginCents)} warn={data.kpis.month.estimatedMarginCents < 0} />
                <MetricCard title="Margen caja" value={eur(data.kpis.month.cashMarginCents)} warn={data.kpis.month.cashMarginCents < 0} />
              </div>

              <DataTable
                columns={[
                  { key: "nombre", label: "Concepto" },
                  { key: "total", label: "Importe", align: "right" },
                ]}
                rows={operationsCostRows}
              />
            </Section>
          </div>

          <Section title="Caja por origen" subtitle="Cobro del día separado por Store, Booth y Bar.">
            <DataTable
              columns={[
                { key: "origen", label: "Origen" },
                { key: "total", label: "Cobrado hoy", align: "right" },
              ]}
              rows={cashOriginRows}
            />
          </Section>

          <div style={twoCol}>
            <Section title="Captación" subtitle="Origen declarado por el cliente en reservas del mes.">
              <DataTable
                columns={[
                  { key: "nombre", label: "Cómo nos conoció" },
                  { key: "reservas", label: "Reservas", align: "right" },
                  { key: "ventas", label: "Ventas", align: "right" },
                  { key: "ticket", label: "Ticket", align: "right" },
                ]}
                rows={data.marketing.slice(0, 10).map((row) => ({
                  nombre: fixText(row.source, "Sin dato"),
                  reservas: fmtInt(row.reservations),
                  ventas: eur(row.salesCents),
                  ticket: eur(row.averageTicketCents),
                }))}
              />
            </Section>

            <Section title="Rendimiento comercial" subtitle="Top de canales y servicios por ventas.">
              <div style={{ display: "grid", gap: 16 }}>
                <DataTable
                  columns={[
                    { key: "nombre", label: "Canal" },
                    { key: "reservas", label: "Reservas", align: "right" },
                    { key: "ventas", label: "Ventas", align: "right" },
                    { key: "ticket", label: "Ticket", align: "right" },
                  ]}
                  rows={data.channels.slice(0, 8).map((row) => ({
                    nombre: fixText(row.channel, "Sin canal"),
                    reservas: fmtInt(row.reservations),
                    ventas: eur(row.salesCents),
                    ticket: eur(row.averageTicketCents),
                  }))}
                />

                <DataTable
                  columns={[
                    { key: "nombre", label: "Servicio" },
                    { key: "reservas", label: "Reservas", align: "right" },
                    { key: "ventas", label: "Ventas", align: "right" },
                    { key: "ticket", label: "Ticket", align: "right" },
                  ]}
                  rows={data.services.slice(0, 8).map((row) => ({
                    nombre: fixText(row.service, "Sin servicio"),
                    reservas: fmtInt(row.reservations),
                    ventas: eur(row.salesCents),
                    ticket: eur(row.averageTicketCents),
                  }))}
                />
              </div>
            </Section>
          </div>

          <div style={twoCol}>
            <Section title="Gastos por categoría" subtitle="Top de categorías de gasto del mes.">
              <div style={chartMedium}>
                <ResponsiveContainer>
                  <BarChart data={expenseCategories} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => eurCompact(value)} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Total" fill="#dc2626" radius={[0, 10, 10, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Centros de coste" subtitle="Distribución por área operativa.">
              <DataTable
                columns={[
                  { key: "centro", label: "Centro" },
                  { key: "numero", label: "N.", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={data.expenses.byCostCenter.map((row) => ({
                  centro: costCenterLabel(row.costCenter),
                  numero: fmtInt(row.count),
                  total: eur(row.totalCents),
                }))}
              />
            </Section>

            <Section title="Proveedores" subtitle="Top de proveedores por importe.">
              <DataTable
                columns={[
                  { key: "nombre", label: "Proveedor" },
                  { key: "numero", label: "N.", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={data.expenses.byVendor.slice(0, 10).map((row) => ({
                  nombre: fixText(row.vendor, "Sin proveedor"),
                  numero: fmtInt(row.count),
                  total: eur(row.totalCents),
                }))}
              />
            </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Section(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={sectionCard}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={sectionTitle}>{props.title}</div>
          <div style={sectionSubtitle}>{props.subtitle}</div>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function HeroStat(props: { label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div
      style={{
        ...heroStatCard,
        borderColor: props.danger ? "#fecaca" : "#dbe4ea",
        background: props.danger ? "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)" : heroStatCard.background,
      }}
    >
      <div style={labelStyle}>{props.label}</div>
      <div style={{ ...heroValueStyle, color: props.danger ? "#b91c1c" : "#0f172a" }}>{props.value}</div>
      <div style={detailStyle}>{props.detail}</div>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; warn?: boolean }) {
  return (
    <div
      style={{
        ...metricCard,
        borderColor: props.warn ? "#fde68a" : "#dbe4ea",
        background: props.warn ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : metricCard.background,
      }}
    >
      <div style={labelStyle}>{props.title}</div>
      <div style={{ ...metricValueStyle, color: props.warn ? "#92400e" : "#0f172a" }}>{props.value}</div>
    </div>
  );
}

function BriefCard(props: {
  title: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        ...briefCard,
        borderColor: props.warn ? "#fde68a" : "#dbe4ea",
        background: props.warn
          ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)"
          : briefCard.background,
      }}
    >
      <div style={labelStyle}>{props.title}</div>
      <div style={{ ...metricValueStyle, color: props.warn ? "#92400e" : "#0f172a" }}>
        {props.value}
      </div>
      <div style={detailStyle}>{props.detail}</div>
    </div>
  );
}

function MetaBadge(props: { label: string; value: string }) {
  return (
    <div style={metaBadge}>
      <div style={metaLabel}>{props.label}</div>
      <div style={metaValue}>{props.value}</div>
    </div>
  );
}

function DataTable(props: {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string>>;
}) {
  return (
    <div style={tableWrap}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column.key} style={{ ...thStyle, textAlign: column.align === "right" ? "right" : "left" }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td colSpan={props.columns.length} style={emptyStyle}>Sin datos.</td>
            </tr>
          ) : (
            props.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {props.columns.map((column) => (
                  <td key={column.key} style={{ ...tdStyle, textAlign: column.align === "right" ? "right" : "left" }}>
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      {props.label ? <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.label}</div> : null}
      {props.payload.map((item, index) => {
        const name = String(item.name ?? `Serie ${index + 1}`);
        const value = item.value;
        let rendered = String(value ?? "-");
        if (typeof value === "number") {
          rendered = ["Ventas", "Cobrado", "Payroll", "Mantenimiento", "Margen", "Total"].includes(name)
            ? eur(value)
            : fmtInt(value);
        }
        return (
          <div key={`${name}-${index}`} style={tooltipRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...dotStyle, background: item.color ?? "#0f172a" }} />
              <span>{name}</span>
            </div>
            <strong>{rendered}</strong>
          </div>
        );
      })}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1480,
  margin: "0 auto",
  padding: "24px 24px 32px",
  fontFamily: "system-ui",
  display: "grid",
  gap: 20,
  background:
    "radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 26%), radial-gradient(circle at top right, rgba(249, 115, 22, 0.08), transparent 22%), linear-gradient(180deg, #f8fbfd 0%, #f3f7fa 100%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 28,
  padding: 24,
  background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #f8fafc 46%, #ecfeff 100%)",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.07)",
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

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #d0d9e4",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  textDecoration: "none",
};

const infoBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  color: "#334155",
};

const errorBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const heroStatsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const metaGrid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const metaBadge: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.88)",
  display: "grid",
  gap: 4,
  minWidth: 140,
};

const metaLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748b",
};

const metaValue: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
};

const heroStatCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: 6,
  minHeight: 118,
};

const sectionCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  padding: 18,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
  boxShadow: "0 16px 38px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: 14,
  alignContent: "start",
  height: "100%",
};

const sectionHeaderStyle: React.CSSProperties = {
  paddingBottom: 12,
  borderBottom: "1px solid #edf2f7",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
  color: "#0f172a",
};

const sectionSubtitle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const heroValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  lineHeight: 1.05,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.1,
};

const detailStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const metricsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const briefGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const metricCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 6,
  minHeight: 98,
};

const briefCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 8,
  minHeight: 112,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
  gap: 20,
  alignItems: "stretch",
};

const threeCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 20,
  alignItems: "stretch",
};

const chartLarge: React.CSSProperties = {
  width: "100%",
  height: 360,
};

const chartMedium: React.CSSProperties = {
  width: "100%",
  height: 300,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  color: "#0f172a",
};

const emptyStyle: React.CSSProperties = {
  padding: 18,
  textAlign: "center",
  color: "#64748b",
};

const tooltipStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 14,
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
  padding: 12,
};

const tooltipRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginTop: 6,
  fontSize: 13,
};

const dotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  display: "inline-block",
};
