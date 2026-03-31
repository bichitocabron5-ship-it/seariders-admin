// src/app/executive/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ExecutiveOpsSummarySection from "./_components/ExecutiveOpsSummarySection";
import ExecutiveCommercialSection from "./_components/ExecutiveCommercialSection";
import ExecutiveExpenseSection from "./_components/ExecutiveExpenseSection";
import ExecutiveBarAccountingSection from "./_components/ExecutiveBarAccountingSection";
import ExecutiveSalesTrendsSection from "./_components/ExecutiveSalesTrendsSection";
import {
  ExecutiveBriefCard as BriefCard,
  ExecutiveDataTable as DataTable,
  ExecutiveHeroStat as HeroStat,
  ExecutiveMetricCard as MetricCard,
  ExecutiveMetaBadge as MetaBadge,
  ExecutiveSection as Section,
  executiveStyles,
} from "@/components/executive-ui";

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
      setError(e instanceof Error ? e.message : "Error cargando el panel operativo");
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

  const hrMetrics = useMemo(
    () =>
      data
        ? [
            { title: "Hoy", value: fmtMinutes(data.hr.approvedMinutesToday) },
            { title: "Semana", value: fmtMinutes(data.hr.approvedMinutesWeek) },
            { title: "Mes", value: fmtMinutes(data.hr.approvedMinutesMonth) },
            { title: "Payroll pendiente", value: eur(data.hr.pendingPayrollCents), warn: data.hr.pendingPayrollCents > 0 },
            { title: "Coste del mes", value: eur(data.hr.monthPayrollCents) },
            { title: "Prácticas activas", value: fmtInt(data.hr.activeInterns) },
            { title: "Bolsa baja", value: fmtInt(data.hr.internshipLowBalance), warn: data.hr.internshipLowBalance > 0 },
          ]
        : [],
    [data]
  );

  const mechanicsMetrics = useMemo(
    () =>
      data
        ? [
            { title: "Eventos abiertos", value: fmtInt(data.mechanics.openEvents), warn: data.mechanics.openEvents > 0 },
            { title: "Eventos críticos", value: fmtInt(data.mechanics.criticalEvents), warn: data.mechanics.criticalEvents > 0 },
            { title: "Coste total", value: eur(data.mechanics.monthCostCents) },
            { title: "Piezas", value: eur(data.mechanics.monthPartsCostCents) },
            { title: "Mano de obra", value: eur(data.mechanics.monthLaborCostCents) },
            { title: "Stock bajo", value: fmtInt(data.mechanics.lowStockParts), warn: data.mechanics.lowStockParts > 0 },
          ]
        : [],
    [data]
  );

  const expensesMetrics = useMemo(
    () =>
      data
        ? [
            { title: "Total mes", value: eur(data.expenses.monthTotalCents) },
            { title: "Pagado", value: eur(data.expenses.monthPaidCents) },
            { title: "Pendiente", value: eur(data.expenses.monthPendingCents), warn: data.expenses.monthPendingCents > 0 },
            { title: "Número de gastos", value: fmtInt(data.expenses.monthCount) },
            { title: "Margen estimado", value: eur(data.kpis.month.estimatedMarginCents), warn: data.kpis.month.estimatedMarginCents < 0 },
            { title: "Margen caja", value: eur(data.kpis.month.cashMarginCents), warn: data.kpis.month.cashMarginCents < 0 },
          ]
        : [],
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

  const marketingRows = useMemo(
    () =>
      data?.marketing.slice(0, 10).map((row) => ({
        nombre: fixText(row.source, "Sin dato"),
        reservas: fmtInt(row.reservations),
        ventas: eur(row.salesCents),
        ticket: eur(row.averageTicketCents),
      })) ?? [],
    [data]
  );

  const channelRows = useMemo(
    () =>
      data?.channels.slice(0, 8).map((row) => ({
        nombre: fixText(row.channel, "Sin canal"),
        reservas: fmtInt(row.reservations),
        ventas: eur(row.salesCents),
        ticket: eur(row.averageTicketCents),
      })) ?? [],
    [data]
  );

  const serviceRows = useMemo(
    () =>
      data?.services.slice(0, 8).map((row) => ({
        nombre: fixText(row.service, "Sin servicio"),
        reservas: fmtInt(row.reservations),
        ventas: eur(row.salesCents),
        ticket: eur(row.averageTicketCents),
      })) ?? [],
    [data]
  );

  const costCenterRows = useMemo(
    () =>
      data?.expenses.byCostCenter.map((row) => ({
        centro: costCenterLabel(row.costCenter),
        numero: fmtInt(row.count),
        total: eur(row.totalCents),
      })) ?? [],
    [data]
  );

  const expenseVendorRows = useMemo(
    () =>
      data?.expenses.byVendor.slice(0, 10).map((row) => ({
        nombre: fixText(row.vendor, "Sin proveedor"),
        numero: fmtInt(row.count),
        total: eur(row.totalCents),
      })) ?? [],
    [data]
  );

  const barAccountingMetrics = useMemo(
    () =>
      data
        ? [
            { title: "Ventas mes", value: eur(data.barAccounting.monthSalesCents) },
            { title: "Ventas normales", value: eur(data.barAccounting.monthRegularSalesCents) },
            { title: "Ventas staff", value: eur(data.barAccounting.monthStaffSalesCents) },
            { title: "Compras mes", value: eur(data.barAccounting.monthPurchasesCents) },
            { title: "Compras pagadas", value: eur(data.barAccounting.monthPurchasesPaidCents) },
            { title: "Compras pendientes", value: eur(data.barAccounting.monthPurchasesPendingCents), warn: data.barAccounting.monthPurchasesPendingCents > 0 },
            { title: "Coste teórico ventas", value: eur(data.barAccounting.costTheoreticalCents) },
            { title: "Margen aprox.", value: eur(data.barAccounting.marginApproxCents), warn: data.barAccounting.marginApproxCents < 0 },
            { title: "Margen bruto real", value: eur(data.barAccounting.marginRealCents), warn: data.barAccounting.marginRealCents < 0 },
          ]
        : [],
    [data]
  );

  const todaySalesMetrics = useMemo(
    () =>
      data
        ? {
            sales: eur(data.kpis.today.salesCents),
            collected: eur(data.kpis.today.collectedCents),
            pending: eur(data.kpis.today.pendingCents),
            reservations: fmtInt(data.kpis.today.reservations),
            pendingWarn: data.kpis.today.pendingCents > 0,
          }
        : null,
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

      {loading ? <div style={infoBox}>Cargando panel...</div> : null}
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

          {todaySalesMetrics ? (
            <ExecutiveSalesTrendsSection
              sales7d={sales7d}
              sales30d={sales30d}
              months6={months6}
              todayMetrics={todaySalesMetrics}
            />
          ) : null}

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
                <MetricCard title="Mantenimiento crítico" value={fmtInt(data.health.maintenanceCritical)} warn={data.health.maintenanceCritical > 0} />
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

          <ExecutiveBarAccountingSection
            metrics={barAccountingMetrics}
            categoryRows={barCategoryRows}
            vendorRows={barVendorRows}
            marginRows={barMarginProductRows}
          />

          <ExecutiveOpsSummarySection
            hrMetrics={hrMetrics}
            mechanicsMetrics={mechanicsMetrics}
            expensesMetrics={expensesMetrics}
            operationsCostRows={operationsCostRows}
          />

          <Section title="Caja por origen" subtitle="Cobro del día separado por Store, Booth y Bar.">
            <DataTable
              columns={[
                { key: "origen", label: "Origen" },
                { key: "total", label: "Cobrado hoy", align: "right" },
              ]}
              rows={cashOriginRows}
            />
          </Section>

          <ExecutiveCommercialSection
            marketingRows={marketingRows}
            channelRows={channelRows}
            serviceRows={serviceRows}
          />

          <ExecutiveExpenseSection
            expenseCategories={expenseCategories}
            costCenterRows={costCenterRows}
            vendorRows={expenseVendorRows}
          />
        </>
      ) : null}
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

const metricsGrid: React.CSSProperties = {
  ...executiveStyles.metricsGrid,
};

const heroStatsGrid: React.CSSProperties = { ...executiveStyles.heroStatsGrid };
const metaGrid: React.CSSProperties = { ...executiveStyles.metaGrid };
const briefGrid: React.CSSProperties = { ...executiveStyles.briefGrid };

const twoCol: React.CSSProperties = {
  ...executiveStyles.twoCol,
};

