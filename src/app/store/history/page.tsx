"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import { StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import { Button, Card, Input, Pill, Select, styles } from "@/components/ui";
import StoreHistoryResultsSection from "./_components/StoreHistoryResultsSection";

type HistoryIncident = {
  id: string;
  type: string;
  level: string;
  status: string;
  isOpen: boolean;
  retainDeposit: boolean;
  retainDepositCents: number | null;
  description: string | null;
  notes: string | null;
  maintenanceEventId: string | null;
  createdAt: string;
  entityType: string | null;
  jetskiId: string | null;
  assetId: string | null;
};

type HistoryRow = {
  id: string;
  status: string;
  activityDate: string;
  scheduledTime: string | null;
  arrivalAt: string | null;
  customerName: string | null;
  customerCountry: string | null;
  quantity: number | null;
  pax: number | null;
  isLicense: boolean | null;
  totalPriceCents: number | null;
  depositCents: number | null;
  depositHeld: boolean;
  depositHoldReason: string | null;
  source: string | null;
  formalizedAt: string | null;
  channelName: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  paidCents: number;
  paidDepositCents: number;
  depositCollectedCents: number;
  depositReturnedCents: number;
  depositRetainedCents: number;
  totalToChargeCents: number;
  incidents: HistoryIncident[];
};

function euros(cents: number | null | undefined) {
  return `${((Number(cents ?? 0)) / 100).toFixed(2)} EUR`;
}

function dt(v: string | null | undefined) {
  if (!v) return "-";
  return new Date(v).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reservationHref(reservationId: string) {
  return `/store?reservationId=${reservationId}`;
}

function mechanicsDetailHref(incident: {
  entityType?: string | null;
  jetskiId?: string | null;
  assetId?: string | null;
}) {
  if (incident.entityType === "JETSKI" && incident.jetskiId) {
    return `/mechanics/jetski/${incident.jetskiId}`;
  }

  if (incident.entityType === "ASSET" && incident.assetId) {
    return `/mechanics/asset/${incident.assetId}`;
  }

  return "/mechanics";
}

function mechanicsEventHref(incident: {
  entityType?: string | null;
  jetskiId?: string | null;
  assetId?: string | null;
  maintenanceEventId?: string | null;
}) {
  const base =
    incident.entityType === "JETSKI" && incident.jetskiId
      ? `/mechanics/jetski/${incident.jetskiId}`
      : incident.entityType === "ASSET" && incident.assetId
        ? `/mechanics/asset/${incident.assetId}`
        : "/mechanics";

  if (!incident.maintenanceEventId) return base;

  return `${base}?eventId=${incident.maintenanceEventId}`;
}

function statusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return { bg: "#ecfdf5", border: "#bbf7d0", color: "#166534" };
    case "IN_SEA":
    case "READY_FOR_PLATFORM":
      return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
    case "WAITING":
      return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    case "CANCELED":
      return { bg: "#f8fafc", border: "#cbd5e1", color: "#475569" };
    default:
      return { bg: "#f8fafc", border: "#dbe4ea", color: "#334155" };
  }
}

function incidentTone(level: string) {
  switch (level) {
    case "HIGH":
    case "CRITICAL":
      return { bg: "#fff1f2", border: "#fecdd3", color: "#be123c" };
    case "MEDIUM":
      return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    default:
      return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
  }
}

function countPaidServiceCents(row: HistoryRow) {
  return Math.max(0, Number(row.paidCents ?? 0) - Number(row.paidDepositCents ?? 0));
}

function countPendingServiceCents(row: HistoryRow) {
  return Math.max(0, Number(row.totalToChargeCents ?? 0) - countPaidServiceCents(row));
}

function countPendingDepositCents(row: HistoryRow) {
  return Math.max(0, Number(row.depositCents ?? 0) - Number(row.paidDepositCents ?? 0));
}

export default function StoreHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [hasIncident, setHasIncident] = useState("ALL");
  const [depositHeld, setDepositHeld] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status !== "ALL") p.set("status", status);
    if (hasIncident !== "ALL") p.set("hasIncident", hasIncident);
    if (depositHeld !== "ALL") p.set("depositHeld", depositHeld);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    p.set("take", "100");
    return p.toString();
  }, [q, status, hasIncident, depositHeld, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/reservations/history?${queryString}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando histórico");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.withIncidents += row.incidents.length > 0 ? 1 : 0;
        acc.depositHeld += row.depositHeld ? 1 : 0;
        acc.serviceChargedCents += countPaidServiceCents(row);
        acc.pendingCents += countPendingServiceCents(row) + countPendingDepositCents(row);
        return acc;
      },
      {
        total: 0,
        withIncidents: 0,
        depositHeld: 0,
        serviceChargedCents: 0,
        pendingCents: 0,
      },
    );
  }, [rows]);

  const activeFilterCount = useMemo(() => {
    return [q.trim(), status !== "ALL", hasIncident !== "ALL", depositHeld !== "ALL", dateFrom, dateTo].filter(Boolean)
      .length;
  }, [q, status, hasIncident, depositHeld, dateFrom, dateTo]);

  function resetFilters() {
    setQ("");
    setStatus("ALL");
    setHasIncident("ALL");
    setDepositHeld("ALL");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div style={page}>
      <section style={heroCard}>
        <div style={heroHeader}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={eyebrow}>Store</div>
            <h1 style={heroTitle}>Histórico de reservas</h1>
            <div style={heroSubtitle}>
              Consulta devoluciones, incidencias, cobros y retenciones en una vista ordenada y alineada con la operativa
              de tienda.
            </div>
          </div>

          <div style={opsStyles.actionGrid}>
            <a href="/store" style={secondaryLink}>
              Volver a Store
            </a>
            <button onClick={load} style={primaryButton} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <StoreMetricGrid>
          <StoreMetricCard label="Reservas listadas" value={summary.total} />
          <StoreMetricCard label="Con incidencia" value={summary.withIncidents} />
          <StoreMetricCard label="Fianza retenida" value={summary.depositHeld} />
          <StoreMetricCard label="Servicio cobrado" value={euros(summary.serviceChargedCents)} />
          <StoreMetricCard label="Pendiente total" value={euros(summary.pendingCents)} />
        </StoreMetricGrid>
      </section>

      <Card
        title="Filtros"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill>{activeFilterCount} filtros activos</Pill>
            <Button onClick={resetFilters} disabled={activeFilterCount === 0}>
              Limpiar
            </Button>
          </div>
        }
      >
        <div style={filtersGrid}>
          <label style={field}>
            <span style={fieldLabel}>Buscar cliente</span>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del cliente" />
          </label>

          <label style={field}>
            <span style={fieldLabel}>Estado</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="WAITING">WAITING</option>
              <option value="READY_FOR_PLATFORM">READY_FOR_PLATFORM</option>
              <option value="IN_SEA">IN_SEA</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELED">CANCELED</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Incidencia</span>
            <Select value={hasIncident} onChange={(e) => setHasIncident(e.target.value)}>
              <option value="ALL">Todas</option>
              <option value="true">Con incidencia</option>
              <option value="false">Sin incidencia</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Fianza retenida</span>
            <Select value={depositHeld} onChange={(e) => setDepositHeld(e.target.value)}>
              <option value="ALL">Todas</option>
              <option value="true">Retenida</option>
              <option value="false">No retenida</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Desde</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label style={field}>
            <span style={fieldLabel}>Hasta</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
      </Card>
      <StoreHistoryResultsSection
        rows={rows}
        loading={loading}
        error={error}
        euros={euros}
        dt={dt}
        statusTone={statusTone}
        incidentTone={incidentTone}
        countPaidServiceCents={countPaidServiceCents}
        countPendingServiceCents={countPendingServiceCents}
        mechanicsDetailHref={mechanicsDetailHref}
        mechanicsEventHref={mechanicsEventHref}
        reservationHref={reservationHref}
        cell={cell}
        mutedText={mutedText}
        mutedStack={mutedStack}
        detailBlock={detailBlock}
        badgeBase={badgeBase}
        moneyValue={moneyValue}
        incidentCard={incidentCard}
        incidentSummary={incidentSummary}
        actionLink={actionLink}
        emptyState={emptyState}
      />
    </div>
  );
}

const page: CSSProperties = {
  ...storeStyles.shell,
  width: "min(1760px, 100%)",
  display: "grid",
  gap: 18,
};

const heroCard: CSSProperties = {
  ...storeStyles.panel,
  background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)",
  borderRadius: 26,
  padding: 22,
  display: "grid",
  gap: 18,
};

const heroHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 18,
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#58708f",
};

const heroTitle: CSSProperties = {
  ...opsStyles.heroTitle,
  margin: 0,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  lineHeight: 1,
  color: "#142033",
};

const heroSubtitle: CSSProperties = {
  fontSize: 14,
  color: "#51627b",
  maxWidth: 760,
};

const secondaryLink: CSSProperties = {
  ...storeStyles.secondaryButton,
  padding: "10px 12px",
  color: "#111",
  fontWeight: 900,
  textDecoration: "none",
};

const primaryButton: CSSProperties = {
  ...storeStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const field: CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const emptyState: CSSProperties = {
  padding: "26px 10px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const cell: CSSProperties = {
  ...styles.td,
  padding: "16px 12px",
};

const mutedText: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const mutedStack: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#64748b",
};

const detailBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid #edf2f7",
  borderRadius: 12,
  background: "#f8fafc",
  fontSize: 12,
  color: "#334155",
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const moneyValue: CSSProperties = {
  fontWeight: 900,
  color: "#0f172a",
};

const incidentCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 14,
  padding: 10,
};

const incidentSummary: CSSProperties = {
  cursor: "pointer",
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  listStyle: "none",
};

const actionLink: CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
