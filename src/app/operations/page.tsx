// src/app/operations/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import OperationsAlertsSection from "./_components/OperationsAlertsSection";
import OperationsBoardSection from "./_components/OperationsBoardSection";
import WaitTimesSection from "./_components/WaitTimesSection";

type OperationCard = {
  id: string;
  bucket: "pending" | "upcoming" | "ready" | "inSea" | "completed";

  createdAt: string | null;
  updatedAt: string | null;
  activityDate: string | null;
  scheduledTime: string | null;
  formalizedAt: string | null;

  customerName: string;
  customerCountry: string | null;
  companionsCount: number;

  serviceName: string | null;
  durationMinutes: number | null;
  channelName: string | null;

  source: string | null;
  boothCode: string | null;
  arrivedStoreAt: string | null;

  taxiboatTripId: string | null;
  taxiboatBoat: string | null;
  taxiboatTripNo: number | null;
  taxiboatDepartedAt: string | null;

  status: string | null;
  minsToStart: number | null;

  soldTotalCents: number;
  pendingCents: number;
  pendingServiceCents: number;
  pendingDepositCents: number;
  paidCents: number;

  depositStatus: string;
  depositHeld: boolean;
  depositHoldReason: string | null;

  startingSoon: boolean;
  overdueStart: boolean;
  notReadyEnough: boolean;
  criticalPendingPayment: boolean;
  criticalContractsIncomplete: boolean;
  taxiboatBlocked: boolean;
  overdueOperation: boolean;

  contractsBadge: {
    requiredUnits: number;
    readyCount: number;
  } | null;
  contractsIncomplete: boolean;
  platformExtrasPendingCount: number;

  waitingTooLong: boolean;
  missingAssignment: boolean;
  unformalized: boolean;

  notes: string | null;
  detailHref?: string | null;

  items: Array<{
    id: string;
    isExtra: boolean;
    serviceName: string | null;
    quantity: number;
    pax: number | null;
    durationMinutes: number | null;
    totalPriceCents: number | null;
  }>;

  extras: Array<{
    id: string;
    serviceName: string | null;
    quantity: number;
    pax: number | null;
    totalPriceCents: number | null;
  }>;
};

type OverviewResponse = {
  ok: true;
  businessDate: string;
  summary: {
    totalToday: number;
    pending: number;
    upcoming: number;
    ready: number;
    inSea: number;
    completed: number;
    incidentsOpen: number;
    saturationWarnings: number;
    pendingPayments: number;
    unformalized: number;
    criticalAlerts: number;
  };
  alerts: {
    unformalized: OperationCard[];
    waitingTooLong: OperationCard[];
    missingAssignment: OperationCard[];
    startingSoonNotReady: OperationCard[];
    overdueOperations: OperationCard[];
    criticalPendingPayments: OperationCard[];
    criticalContracts: OperationCard[];
    taxiboatBlocked: OperationCard[];
    completeOrSaturated: Array<{
      reservationId: string;
      customerName: string;
      serviceName: string | null;
      message: string;
    }>;
    pendingPayments: OperationCard[];
  };
  board: {
    pending: OperationCard[];
    upcoming: OperationCard[];
    ready: OperationCard[];
    inSea: OperationCard[];
    completed: OperationCard[];
  };
  saturation: Array<{
    serviceName: string | null;
    count: number;
    reservations: Array<{
      id: string;
      customerName: string;
      scheduledTime: string | null;
      status: string | null;
    }>;
  }>;
  areas: {
    booth: {
      pendingArrivalToStore: OperationCard[];
      arrivedToStore: OperationCard[];
      taxiboatPendingDeparture: OperationCard[];
    };
    store: {
      unformalized: OperationCard[];
      pendingPayments: OperationCard[];
      incompleteContracts: OperationCard[];
    };
    platform: {
      ready: OperationCard[];
      inSea: OperationCard[];
      extrasPending: OperationCard[];
    };
    bar: {
      pendingDeliveries: OperationCard[];
      pendingReturns: OperationCard[];
      incidents: OperationCard[];
    };
  };
};

type WaitTimesResponse = {
  ok: true;
  generatedAt: string;
  ymd: string;
  sla: {
    boothAssignTaxiMin: number;
    taxiDepartAfterAssignMin: number;
    boothToDepartMin: number;
    boothToStoreMin: number;
    platformToBoothLiveMin: number;
    storeQueueMin: number;
    storeFormalizeMin: number;
    storeFormalizeToPaymentMin: number;
    storePaymentToReadyMin: number;
    storeTotalToReadyMin: number;
    platformQueueLiveMin: number;
    platformUnitToAssignMin: number;
    platformAssignToSeaMin: number;
    seaDurationMin: number;
    seaDelayMin: number;
  };
  summary: {
    boothAssignTaxiAvgMin: number | null;
    taxiAssignToDepartAvgMin: number | null;
    boothToDepartAvgMin: number | null;
    boothToStoreTripAvgMin: number | null;
    boothToStoreTotalAvgMin: number | null;
    platformToBoothLiveAvgMin: number | null;

    storeQueueAvgMin: number | null;
    storeArrivedToFormalizedAvgMin: number | null;
    storeFormalizedToPaymentAvgMin: number | null;
    storePaymentToReadyAvgMin: number | null;
    storeFormalizedToReadyAvgMin: number | null;

    platformQueueLiveAvgMin: number | null;
    platformUnitToAssignAvgMin: number | null;
    platformAssignToSeaAvgMin: number | null;

    seaDurationAvgMin: number | null;
    seaDelayAvgMin: number | null;
    runOpenDurationAvgMin: number | null;
  };
  counts: {
    reservations: number;
    unitsReadyForPlatformWithoutAssignment: number;
    activeAlerts: number;
    assignments: number;
  };
  active: Array<{
    reservationId: string;
    label: string;
    phase: string;
    source: string | null;
    formalizedAt: string | null;
    waitedMin: number;
    targetMin: number;
    overByMin: number;
    startedAt: string;
    scheduledTime: string | null;
  }>;
  phaseRows: Array<{
    phase: string;
    avgMin: number | null;
    maxMin: number | null;
    cases: number;
    slaTargetMin: number;
    slaOkPct: number | null;
  }>;
};

type AemetDay = {
  fecha: string;
  cielo: {
    manana: string | null;
    tarde: string | null;
  };
  viento: {
    manana: string | null;
    tarde: string | null;
  };
  oleaje: {
    manana: string | null;
    tarde: string | null;
  };
  temperaturaMaxima: number | null;
  temperaturaAgua: number | null;
  uv: number | null;
};

type AemetResponse = {
  ok: boolean;
  data: {
    fuente: string;
    fuenteUrl: string;
    playa: string;
    elaborado: string | null;
    dias: AemetDay[];
  } | null;
  stale: boolean;
  cachedAt: string | null;
  error: string | null;
};

function eur(cents: number | null | undefined) {
  if (cents == null) return "-";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      dateStyle: "full",
    });
  } catch {
    return iso;
  }
}

function fmtShortDateTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function fmtAemetDay(value: string) {
  if (!/^\d{8}$/.test(value)) return value;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  return new Date(year, month, day).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function textOrDash(value: string | number | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function waitSeverity(waitedMin: number, targetMin: number) {
  if (!Number.isFinite(waitedMin) || !Number.isFinite(targetMin) || targetMin <= 0) {
    return "neutral" as const;
  }

  if (waitedMin <= targetMin) return "ok" as const;
  if (waitedMin <= targetMin * 1.5) return "warn" as const;
  return "danger" as const;
}

function pctSeverity(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "neutral" as const;
  if (value >= 90) return "ok" as const;
  if (value >= 75) return "warn" as const;
  return "danger" as const;
}

function waitSeverityColors(level: "ok" | "warn" | "danger" | "neutral") {
  switch (level) {
    case "ok":
      return {
        bg: "#f0fdf4",
        border: "#bbf7d0",
        text: "#166534",
      };
    case "warn":
      return {
        bg: "#fff7ed",
        border: "#fed7aa",
        text: "#b45309",
      };
    case "danger":
      return {
        bg: "#fff1f2",
        border: "#fecaca",
        text: "#b91c1c",
      };
    default:
      return {
        bg: "#f8fafc",
        border: "#e2e8f0",
        text: "#475569",
      };
  }
}

function severityLabel(level: "ok" | "warn" | "danger" | "neutral") {
  switch (level) {
    case "ok":
      return "OK";
    case "warn":
      return "ATENCIÓN";
    case "danger":
      return "CRÍTICO";
    default:
      return "—";
  }
}

function phaseLink(row: { phase: string; reservationId: string; source?: string | null; formalizedAt?: string | null }) {
  const p = row.phase.toUpperCase();

  if (p.includes("BOOTH")) {
    return `/booth?reservationId=${row.reservationId}`;
  }

  if (p.includes("STORE")) {
    return row.source === "BOOTH" && !row.formalizedAt
      ? `/store/create?migrateFrom=${row.reservationId}`
      : `/store/create?editFrom=${row.reservationId}`;
  }

  if (p.includes("PLATFORM")) {
    return `/platform`;
  }

  if (p.includes("SERVICIO")) {
    return `/platform`;
  }

  return `/operations?reservationId=${row.reservationId}`;
}

function fmtMin(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${Math.round(v)} min`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${Math.round(v)}%`;
}

export default function OperationsPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [waitTimes, setWaitTimes] = useState<WaitTimesResponse | null>(null);
  const [waitTimesLoading, setWaitTimesLoading] = useState(false);
  const [waitTimesError, setWaitTimesError] = useState<string | null>(null);
  const [weather, setWeather] = useState<AemetResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);

  const loadWeather = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setWeatherRefreshing(true);
    } else {
      setWeatherLoading(true);
    }

    try {
      const res = await fetch(`/api/weather/aemet${forceRefresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
        method: forceRefresh ? "POST" : "GET",
      });
      const json = (await res.json()) as AemetResponse;
      setWeather(json);
    } catch (e: unknown) {
      setWeather({
        ok: false,
        data: null,
        stale: true,
        cachedAt: null,
        error: e instanceof Error ? e.message : "No se pudo cargar la previsión AEMET.",
      });
    } finally {
      setWeatherLoading(false);
      setWeatherRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWaitTimesLoading(true);
    setWaitTimesError(null);

    try {
      const [overviewRes, waitTimesRes] = await Promise.all([
        fetch("/api/operations/overview", { cache: "no-store" }),
        fetch("/api/operations/wait-times", { cache: "no-store" }),
      ]);

      if (!overviewRes.ok) throw new Error(await overviewRes.text());
      if (!waitTimesRes.ok) throw new Error(await waitTimesRes.text());

      const overviewJson = (await overviewRes.json()) as OverviewResponse;
      const waitTimesJson = (await waitTimesRes.json()) as WaitTimesResponse;

      setData(overviewJson);
      setWaitTimes(waitTimesJson);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error cargando operaciones";
      setError(msg);
      setWaitTimesError(msg);
    } finally {
      setLoading(false);
      setWaitTimesLoading(false);
    }
  }, []);

  useLiveRefresh(load, { intervalMs: 45_000 });

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  const activeWaitRows = useMemo(
    () =>
      (waitTimes?.active ?? []).map((row) => {
        const severity = waitSeverity(row.waitedMin, row.targetMin);

        return {
          reservationId: row.reservationId,
          reserva: row.label,
          fase: row.phase,
          actual: fmtMin(row.waitedMin),
          sla: fmtMin(row.targetMin),
          retraso: row.overByMin > 0 ? `+${row.overByMin} min` : "OK",
          desde: fmtDateTime(row.startedAt),
          prevista: row.scheduledTime ? fmtDateTime(row.scheduledTime) : "—",
          severity,
          severityLabel: severityLabel(severity),
          severityColors: waitSeverityColors(severity),
          href: phaseLink(row),
        };
      }),
    [waitTimes]
  );

  const phaseSummaryRows = useMemo(
    () =>
      (waitTimes?.phaseRows ?? []).map((row) => {
        const severity = pctSeverity(row.slaOkPct);

        return {
          fase: row.phase,
          media: fmtMin(row.avgMin),
          max: fmtMin(row.maxMin),
          casos: String(row.cases),
          sla: fmtMin(row.slaTargetMin),
          cumplimiento: fmtPct(row.slaOkPct),
          severity,
          severityLabel: severityLabel(severity),
          severityColors: waitSeverityColors(severity),
        };
      }),
    [waitTimes]
  );

  const criticalWaitAlerts = useMemo(
    () => (waitTimes?.active ?? []).filter((row) => row.overByMin > 0).slice(0, 8),
    [waitTimes]
  );

  const waitSummaryTiles = useMemo(
    () =>
      waitTimes
        ? [
            { title: "Booth en espera", value: waitTimes.summary.boothToDepartAvgMin, target: waitTimes.sla.boothToDepartMin },
            { title: "Taxi asignado", value: waitTimes.summary.boothAssignTaxiAvgMin, target: waitTimes.sla.boothAssignTaxiMin },
            { title: "Booth -> Store", value: waitTimes.summary.boothToStoreTotalAvgMin, target: waitTimes.sla.boothToStoreMin },
            { title: "Platform -> Booth", value: waitTimes.summary.platformToBoothLiveAvgMin, target: waitTimes.sla.platformToBoothLiveMin },
            { title: "Cola Store", value: waitTimes.summary.storeQueueAvgMin, target: waitTimes.sla.storeQueueMin },
            { title: "Formalizado -> Ready", value: waitTimes.summary.storeFormalizedToReadyAvgMin, target: waitTimes.sla.storeTotalToReadyMin },
            { title: "Cola Platform", value: waitTimes.summary.platformQueueLiveAvgMin, target: waitTimes.sla.platformQueueLiveMin },
            { title: "Asignado -> Mar", value: waitTimes.summary.platformAssignToSeaAvgMin, target: waitTimes.sla.platformAssignToSeaMin },
            { title: "Duración mar", value: waitTimes.summary.seaDurationAvgMin, target: waitTimes.sla.seaDurationMin },
            { title: "Retraso medio", value: waitTimes.summary.seaDelayAvgMin, target: waitTimes.sla.seaDelayMin },
          ].map((item) => {
            const severity = item.value == null ? "neutral" : waitSeverity(item.value, item.target ?? 0);
            return {
              title: item.title,
              value: fmtMin(item.value),
              target: fmtMin(item.target),
              severityLabel: severityLabel(severity),
              colors: waitSeverityColors(severity),
            };
          })
        : [],
    [waitTimes]
  );

  const criticalWaitAlertCards = useMemo(
    () =>
      criticalWaitAlerts.map((row) => {
        const severity = waitSeverity(row.waitedMin, row.targetMin);
        return {
          key: `${row.reservationId}-${row.phase}-${row.startedAt}`,
          href: phaseLink(row),
          label: row.label,
          phase: row.phase,
          waited: fmtMin(row.waitedMin),
          target: fmtMin(row.targetMin),
          overBy: `+${row.overByMin} min`,
          severityLabel: severityLabel(severity),
          colors: waitSeverityColors(severity),
        };
      }),
    [criticalWaitAlerts]
  );

  return (
    <div style={pageShell}>
      <section style={heroCard}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrow}>Operaciones</div>
          <div style={heroTitle}>Centro de operaciones</div>
          <div style={heroText}>
            Vista unificada de reservas, alertas operativas y flujo entre Booth, Store y Platform, con contratos incompletos y extras pendientes.
          </div>
          <div style={heroMetaGrid}>
            <div style={heroInfoCard}>
              <strong>Cobros pendientes</strong>
              <span>Casos que siguen vivos en operación y todavía requieren caja o revisión en tienda.</span>
            </div>
            <div style={heroInfoCard}>
              <strong>Sin formalizar</strong>
              <span>Reservas que no deberían avanzar sin documentación y validación básica completa.</span>
            </div>
            <div style={heroInfoCard}>
              <strong>Cuellos de botella</strong>
              <span>Espera, taxi, platform y mar se leen en una sola capa para priorizar bien.</span>
            </div>
          </div>
          {data ? (
            <div style={heroMeta}>Fecha operativa: {fmtDate(data.businessDate)}</div>
          ) : null}
        </div>

        <div style={heroActions}>
          <button type="button" onClick={load} style={primaryBtn}>
            Refrescar
          </button>
          <a href="/admin" style={secondaryLink}>
            Admin
          </a>
          <a href="/bar" style={secondaryLink}>
            Bar
          </a>
          <a href="/store" style={secondaryLink}>
            Store
          </a>
          <a href="/platform" style={secondaryLink}>
            Platform
          </a>
        </div>
      </section>

      {loading ? <div style={infoBox}>Cargando operaciones...</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      {!loading && data ? (
        <>
          <section style={sectionCard}>
            <div style={sectionHeaderRow}>
              <div>
                <div style={sectionEyebrow}>Resumen</div>
                <div style={sectionTitle}>Indicadores del día</div>
              </div>
            </div>

            <div style={kpiGrid}>
              <Kpi title="Total hoy" value={data.summary.totalToday} />
              <Kpi title="Pendientes" value={data.summary.pending} warn={data.summary.pending > 0} />
              <Kpi title="Próximas" value={data.summary.upcoming} />
              <Kpi title="Ready" value={data.summary.ready} />
              <Kpi title="En mar" value={data.summary.inSea} />
              <Kpi title="Completadas" value={data.summary.completed} />
              <Kpi title="Cobros pendientes" value={data.summary.pendingPayments} warn={data.summary.pendingPayments > 0} />
              <Kpi title="Sin formalizar" value={data.summary.unformalized} warn={data.summary.unformalized > 0} />
              <Kpi title="Alertas críticas" value={data.summary.criticalAlerts} warn={data.summary.criticalAlerts > 0} />
              <Kpi title="Servicios saturados" value={data.summary.saturationWarnings} warn={data.summary.saturationWarnings > 0} />
            </div>
          </section>

          <section style={weatherSectionCard}>
            <div style={sectionHeaderRow}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={weatherEyebrow}>Fuente: AEMET</div>
                <div style={sectionTitle}>Previsión AEMET Playa del Centre</div>
                <div style={weatherMeta}>
                  {weather?.data?.playa ? `${weather.data.playa} · ` : ""}
                  Elaborado {fmtShortDateTime(weather?.data?.elaborado)}
                  {weather?.cachedAt ? ` · Cache ${fmtShortDateTime(weather.cachedAt)}` : ""}
                </div>
              </div>

              <div style={weatherActions}>
                {weather?.stale ? <span style={weatherWarningPill}>Último dato disponible</span> : null}
                <a
                  href={weather?.data?.fuenteUrl ?? "https://www.aemet.es/es/eltiempo/prediccion/playas/del-centre-0801502"}
                  target="_blank"
                  rel="noreferrer"
                  style={secondaryLink}
                >
                  Ver fuente
                </a>
                <button type="button" onClick={() => void loadWeather(true)} style={primaryBtn} disabled={weatherRefreshing}>
                  {weatherRefreshing ? "Actualizando..." : "Actualizar ahora"}
                </button>
              </div>
            </div>

            {weather?.error ? <div style={weather.stale ? weatherWarningBox : errorBox}>{weather.error}</div> : null}
            {weatherLoading ? <div style={infoBox}>Cargando previsión AEMET...</div> : null}
            {!weatherLoading && !weather?.data ? <div style={infoBox}>Sin previsión disponible ahora mismo.</div> : null}

            {weather?.data ? (
              <div style={weatherGrid}>
                {weather.data.dias.map((day) => (
                  <article key={day.fecha} style={weatherCard}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ fontSize: 18, color: "#142033" }}>{fmtAemetDay(day.fecha)}</strong>
                      <div style={weatherMeta}>
                        Máx {textOrDash(day.temperaturaMaxima, "°C")} · Agua {textOrDash(day.temperaturaAgua, "°C")} · UV{" "}
                        {textOrDash(day.uv)}
                      </div>
                    </div>

                    <div style={weatherRows}>
                      <WeatherRow label="Cielo" manana={day.cielo.manana} tarde={day.cielo.tarde} />
                      <WeatherRow label="Viento" manana={day.viento.manana} tarde={day.viento.tarde} />
                      <WeatherRow label="Oleaje" manana={day.oleaje.manana} tarde={day.oleaje.tarde} />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section
            style={{
              display: "grid",
              gap: 16,
              border: "1px solid #dbeafe",
              borderRadius: 20,
              padding: "clamp(18px, 3vw, 24px)",
              background: "#f8fbff",
              boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#0369a1",
                }}
              >
                Tiempos operativos
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                Esperas, SLA y cuellos de botella del día
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Control live de Booth, Store, Platform y servicio en mar.
                {waitTimes?.generatedAt ? ` | Actualizado ${fmtDateTime(waitTimes.generatedAt)}` : ""}
              </div>
            </div>

            <WaitTimesSection
              loading={waitTimesLoading}
              error={waitTimesError}
              generatedAtLabel={waitTimes?.generatedAt ? fmtDateTime(waitTimes.generatedAt) : null}
              summaryTiles={waitSummaryTiles}
              overview={
                waitTimes
                  ? {
                      criticalWaitAlerts: criticalWaitAlerts.length,
                      activeAlerts: waitTimes.counts.activeAlerts,
                      unitsReadyWithoutAssignment: waitTimes.counts.unitsReadyForPlatformWithoutAssignment,
                      assignments: waitTimes.counts.assignments,
                      reservations: waitTimes.counts.reservations,
                    }
                  : null
              }
              alertCards={criticalWaitAlertCards}
              activeWaitRows={activeWaitRows}
              phaseSummaryRows={phaseSummaryRows}
            />
          </section>

          <OperationsAlertsSection alerts={data.alerts} formatEur={eur} />

          <OperationsBoardSection board={data.board} areas={data.areas} saturation={data.saturation} />
        </>
      ) : null}
    </div>
  );
}

function WeatherRow({ label, manana, tarde }: { label: string; manana: string | null; tarde: string | null }) {
  return (
    <div style={weatherRow}>
      <div style={{ fontWeight: 800, color: "#334155" }}>{label}</div>
      <div style={weatherMeta}>Mañana: {textOrDash(manana)}</div>
      <div style={weatherMeta}>Tarde: {textOrDash(tarde)}</div>
    </div>
  );
}


function Kpi({
  title,
  value,
  warn,
}: {
  title: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div style={{ ...kpiCard, ...(warn ? kpiWarn : null) }}>
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950, color: warn ? "#8a5100" : "#142033" }}>
        {value}
      </div>
    </div>
  );
}

const pageShell: CSSProperties = {
  ...opsStyles.pageShell,
  background: "linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%)",
};

const heroCard: CSSProperties = {
  ...opsStyles.heroCard,
  border: "1px solid #d8e0ea",
  background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)",
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  boxShadow: "0 18px 40px rgba(20, 32, 51, 0.08)",
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#58708f",
};

const heroTitle: CSSProperties = {
  ...opsStyles.heroTitle,
  lineHeight: 1,
  fontWeight: 950,
  color: "#142033",
};

const heroText: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  maxWidth: 720,
  color: "#51627b",
};

const heroMeta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#edf3fb",
  border: "1px solid #d6e1ef",
  fontWeight: 800,
  fontSize: 12,
  color: "#27405e",
};

const heroMetaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  maxWidth: 920,
};

const heroInfoCard: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #d6e1ef",
  background: "rgba(255, 255, 255, 0.92)",
  fontSize: 12,
  color: "#40536c",
};

const heroActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
  alignItems: "stretch",
  width: "min(100%, 560px)",
};

const primaryBtn: CSSProperties = {
  ...opsStyles.primaryButton,
  borderRadius: 14,
  border: "1px solid #142033",
  background: "#142033",
  width: "100%",
};

const secondaryLink: CSSProperties = {
  ...opsStyles.ghostButton,
  borderRadius: 14,
  border: "1px solid #d9dee8",
  color: "#142033",
  textAlign: "center",
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #d9dee8",
  background: "#fff",
  fontWeight: 800,
  color: "#51627b",
};

const errorBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const sectionCard: CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #d9dee8",
  background: "rgba(255, 255, 255, 0.92)",
  display: "grid",
  gap: 16,
  boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
};

const weatherSectionCard: CSSProperties = {
  ...sectionCard,
  border: "1px solid #d6e1ef",
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
};

const sectionHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#6c819d",
};

const sectionTitle: CSSProperties = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 950,
  color: "#142033",
};

const weatherEyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#0369a1",
};

const weatherMeta: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const kpiCard: CSSProperties = {
  border: "1px solid #dde4ee",
  background: "#fff",
  borderRadius: 18,
  padding: 14,
};

const kpiWarn: CSSProperties = {
  borderColor: "#f7d58d",
  background: "#fff8e8",
};

const weatherActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const weatherWarningPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontWeight: 800,
  fontSize: 12,
};

const weatherWarningBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontWeight: 800,
};

const weatherGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const weatherCard: CSSProperties = {
  border: "1px solid #dde7f2",
  borderRadius: 18,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const weatherRows: CSSProperties = {
  display: "grid",
  gap: 10,
};

const weatherRow: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
};

