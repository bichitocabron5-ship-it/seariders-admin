// src/app/operations/page.tsx
"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

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
  };
};

function eur(cents: number | null | undefined) {
  if (cents == null) return "-";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
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

function bucketTitle(key: keyof OverviewResponse["board"]) {
  switch (key) {
    case "pending":
      return "Pendiente";
    case "upcoming":
      return "Proximas";
    case "ready":
      return "Ready";
    case "inSea":
      return "In Sea";
    case "completed":
      return "Completadas";
    default:
      return key;
  }
}

function bucketStyle(key: keyof OverviewResponse["board"]): CSSProperties {
  if (key === "pending") return { borderColor: "#f7d58d", background: "#fff8e8" };
  if (key === "upcoming") return { borderColor: "#bfd9ff", background: "#f2f7ff" };
  if (key === "ready") return { borderColor: "#b9ebc7", background: "#f2fbf4" };
  if (key === "inSea") return { borderColor: "#cfd5ff", background: "#f3f5ff" };
  return { borderColor: "#d9dee8", background: "#f7f9fc" };
}

export default function OperationsPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/operations/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as OverviewResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando operaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={pageShell}>
      <section style={heroCard}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrow}>Operations Center</div>
          <div style={heroTitle}>Centro de operaciones</div>
          <div style={heroText}>
            Vista unificada para reservas, alertas criticas y flujo de paso entre Booth, Store y Platform, con contratos incompletos y extras pendientes de plataforma.
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
                <div style={sectionTitle}>Indicadores del dia</div>
              </div>
            </div>

            <div style={kpiGrid}>
              <Kpi title="Total hoy" value={data.summary.totalToday} />
              <Kpi title="Pendiente" value={data.summary.pending} warn={data.summary.pending > 0} />
              <Kpi title="Proximas" value={data.summary.upcoming} />
              <Kpi title="Ready" value={data.summary.ready} />
              <Kpi title="In Sea" value={data.summary.inSea} />
              <Kpi title="Completadas" value={data.summary.completed} />
              <Kpi title="Cobros pendientes" value={data.summary.pendingPayments} warn={data.summary.pendingPayments > 0} />
              <Kpi title="Sin formalizar" value={data.summary.unformalized} warn={data.summary.unformalized > 0} />
              <Kpi title="Alertas criticas" value={data.summary.criticalAlerts} warn={data.summary.criticalAlerts > 0} />
              <Kpi title="Saturacion" value={data.summary.saturationWarnings} warn={data.summary.saturationWarnings > 0} />
            </div>
          </section>

          {(data.alerts.waitingTooLong.length > 0 ||
            data.alerts.missingAssignment.length > 0 ||
            data.alerts.unformalized.length > 0 ||
            data.alerts.pendingPayments.length > 0 ||
            data.alerts.completeOrSaturated.length > 0) ? (
            <section style={sectionCard}>
              <div style={sectionHeaderRow}>
                <div>
                  <div style={sectionEyebrow}>Seguimiento</div>
                  <div style={sectionTitle}>Alertas operativas</div>
                </div>
              </div>

              <div style={alertGrid}>
                {data.alerts.waitingTooLong.map((r) => (
                  <div key={`wtl-${r.id}`} style={alertWarn}>
                    <strong>{r.customerName}</strong> lleva demasiado tiempo en WAITING.
                  </div>
                ))}

                {data.alerts.missingAssignment.map((r) => (
                  <div key={`ma-${r.id}`} style={alertWarn}>
                    <strong>{r.customerName}</strong> tiene asignacion pendiente de taxiboat o plataforma.
                  </div>
                ))}

                {data.alerts.unformalized.map((r) => (
                  <div key={`uf-${r.id}`} style={alertInfo}>
                    <strong>{r.customerName}</strong> sigue sin formalizar.
                  </div>
                ))}

                {data.alerts.pendingPayments.map((r) => (
                  <div key={`pp-${r.id}`} style={alertInfo}>
                    <strong>{r.customerName}</strong> mantiene pendiente <strong>{eur(r.pendingCents)}</strong>.
                  </div>
                ))}

                {data.alerts.completeOrSaturated.map((r) => (
                  <div key={`cs-${r.reservationId}`} style={alertWarn}>
                    <strong>{r.customerName}</strong> · {r.serviceName ?? "Servicio"} · {r.message}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(data.alerts.startingSoonNotReady.length > 0 ||
            data.alerts.overdueOperations.length > 0 ||
            data.alerts.criticalPendingPayments.length > 0 ||
            data.alerts.criticalContracts.length > 0 ||
            data.alerts.taxiboatBlocked.length > 0) ? (
            <section style={criticalCard}>
              <div style={sectionHeaderRow}>
                <div>
                  <div style={sectionEyebrow}>Prioridad alta</div>
                  <div style={{ ...sectionTitle, color: "#8f1d1d" }}>Alertas criticas</div>
                </div>
              </div>

              <div style={alertGrid}>
                {data.alerts.startingSoonNotReady.map((r) => (
                  <div key={`ssnr-${r.id}`} style={criticalBox}>
                    <strong>{r.customerName}</strong> empieza pronto y sigue en <strong>{r.status}</strong>.
                  </div>
                ))}

                {data.alerts.overdueOperations.map((r) => (
                  <div key={`ovr-${r.id}`} style={criticalBox}>
                    <strong>{r.customerName}</strong> ya deberia haber empezado y sigue en <strong>{r.status}</strong>.
                  </div>
                ))}

                {data.alerts.criticalPendingPayments.map((r) => (
                  <div key={`cpp-${r.id}`} style={criticalBox}>
                    <strong>{r.customerName}</strong> tiene un cobro pendiente critico: <strong>{eur(r.pendingCents)}</strong>.
                  </div>
                ))}

                {data.alerts.criticalContracts.map((r) => (
                  <div key={`cc-${r.id}`} style={criticalBox}>
                    <strong>{r.customerName}</strong> tiene contratos incompletos y la salida esta proxima.
                  </div>
                ))}

                {data.alerts.taxiboatBlocked.map((r) => (
                  <div key={`tb-${r.id}`} style={criticalBox}>
                    <strong>{r.customerName}</strong> tiene taxiboat asignado pero aun no ha salido.
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section style={sectionCard}>
            <div style={sectionHeaderRow}>
              <div>
                <div style={sectionEyebrow}>Board</div>
                <div style={sectionTitle}>Estado de reservas</div>
              </div>
            </div>

            <div style={boardGrid}>
              <BoardColumn title={bucketTitle("pending")} rows={data.board.pending} styleExtra={bucketStyle("pending")} />
              <BoardColumn title={bucketTitle("upcoming")} rows={data.board.upcoming} styleExtra={bucketStyle("upcoming")} />
              <BoardColumn title={bucketTitle("ready")} rows={data.board.ready} styleExtra={bucketStyle("ready")} />
              <BoardColumn title={bucketTitle("inSea")} rows={data.board.inSea} styleExtra={bucketStyle("inSea")} />
              <BoardColumn title={bucketTitle("completed")} rows={data.board.completed} styleExtra={bucketStyle("completed")} />
            </div>
          </section>

          <section style={sectionCard}>
            <div style={sectionHeaderRow}>
              <div>
                <div style={sectionEyebrow}>Areas</div>
                <div style={sectionTitle}>Seguimiento por equipo</div>
              </div>
            </div>

            <div style={areaGrid}>
              <AreaBlock
                title="Booth"
                sections={[
                  { title: "Pendientes de llegar a Store", rows: data.areas.booth.pendingArrivalToStore },
                  { title: "Llegados a Store", rows: data.areas.booth.arrivedToStore },
                  { title: "Taxiboat pendiente de salida", rows: data.areas.booth.taxiboatPendingDeparture },
                ]}
              />

              <AreaBlock
                title="Store"
                sections={[
                  { title: "Sin formalizar", rows: data.areas.store.unformalized },
                  { title: "Pendientes de cobro", rows: data.areas.store.pendingPayments },
                  { title: "Contratos incompletos", rows: data.areas.store.incompleteContracts },
                ]}
              />

              <AreaBlock
                title="Platform"
                sections={[
                  { title: "Ready", rows: data.areas.platform.ready },
                  { title: "In Sea", rows: data.areas.platform.inSea },
                  { title: "Extras pendientes", rows: data.areas.platform.extrasPending },
                ]}
              />
            </div>
          </section>

          {data.saturation.length > 0 ? (
            <section style={saturationCard}>
              <div style={sectionHeaderRow}>
                <div>
                  <div style={sectionEyebrow}>Capacidad</div>
                  <div style={{ ...sectionTitle, color: "#8a5100" }}>Saturacion por servicio</div>
                </div>
              </div>

              <div style={saturationGrid}>
                {data.saturation.map((s, idx) => (
                  <div key={`${s.serviceName ?? "service"}-${idx}`} style={saturationItem}>
                    <div style={{ fontWeight: 900 }}>
                      {s.serviceName ?? "Servicio"} · {s.count} reservas en la misma ventana
                    </div>

                    <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 12, opacity: 0.88 }}>
                      {s.reservations.map((r) => (
                        <div key={r.id}>
                          <strong>{r.customerName}</strong>
                          {" · "}{fmtDateTime(r.scheduledTime)}
                          {" · "}{r.status ?? "-"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function BoardColumn({
  title,
  rows,
  styleExtra,
}: {
  title: string;
  rows: OperationCard[];
  styleExtra?: CSSProperties;
}) {
  return (
    <div style={{ ...boardColumn, ...styleExtra }}>
      <div style={columnHeader}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>Reservas en esta fase</div>
        </div>
        <div style={countBadge}>{rows.length}</div>
      </div>

      {rows.length === 0 ? (
        <div style={emptyState}>Sin elementos.</div>
      ) : (
        rows.map((r) => <OperationItem key={r.id} row={r} />)
      )}
    </div>
  );
}

function OperationItem({
  row,
}: {
  row: OperationCard;
}) {
  const statusTone = row.overdueOperation || row.criticalPendingPayment || row.criticalContractsIncomplete
    ? criticalPill
    : row.startingSoon || row.waitingTooLong || row.missingAssignment
      ? warnPill
      : neutralPill;

  return (
    <div style={itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{row.customerName}</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            {row.serviceName ?? "Servicio"}
            {row.durationMinutes ? ` · ${row.durationMinutes} min` : ""}
            {row.channelName ? ` · ${row.channelName}` : ""}
          </div>
        </div>

        <div style={statusTone}>{row.status ?? "-"}</div>
      </div>

      <div style={metaGrid}>
        <Meta label="Hora" value={fmtDateTime(row.scheduledTime ?? row.activityDate)} />
        <Meta label="Pendiente" value={eur(row.pendingCents)} />
        <Meta label="Pagado" value={eur(row.paidCents)} />
        <Meta label="Origen" value={row.source ?? "-"} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {row.companionsCount ? <Tag>{`+${row.companionsCount} acompanantes`}</Tag> : null}
        {row.customerCountry ? <Tag>{row.customerCountry}</Tag> : null}
        {row.boothCode ? <Tag>{`Booth ${row.boothCode}`}</Tag> : null}
        {row.contractsBadge ? <Tag>{`Contratos ${row.contractsBadge.readyCount}/${row.contractsBadge.requiredUnits}`}</Tag> : null}
        {row.platformExtrasPendingCount > 0 ? <Tag tone="warn">{`Extras plataforma ${row.platformExtrasPendingCount}`}</Tag> : null}
      </div>

      {row.taxiboatTripId ? (
        <div style={subtlePanel}>
          Taxiboat: <strong>{row.taxiboatBoat ?? "-"}</strong>
          {row.taxiboatTripNo ? ` · viaje ${row.taxiboatTripNo}` : ""}
          {row.taxiboatDepartedAt ? ` · salido ${fmtDateTime(row.taxiboatDepartedAt)}` : ""}
        </div>
      ) : null}

      {!row.formalizedAt ? (
        <div style={warnBanner}>Pendiente de formalizar.</div>
      ) : null}

      {row.minsToStart !== null ? (
        <div style={{ fontSize: 12, opacity: 0.82 }}>
          {row.minsToStart >= 0
            ? `Empieza en ${row.minsToStart} min`
            : `Retraso ${Math.abs(row.minsToStart)} min`}
        </div>
      ) : null}

      {row.notes ? <div style={{ fontSize: 12, opacity: 0.88 }}>{row.notes}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <a href={`/store/create?editFrom=${row.id}`} style={secondaryLinkSmall}>
          Abrir
        </a>
      </div>
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

function AreaBlock({
  title,
  sections,
}: {
  title: string;
  sections: Array<{
    title: string;
    rows: OperationCard[];
  }>;
}) {
  return (
    <div style={areaCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950, fontSize: 22 }}>{title}</div>
      </div>

      {sections.map((section) => (
        <div key={section.title} style={{ display: "grid", gap: 10 }}>
          <div style={areaSectionHeader}>
            <span>{section.title}</span>
            <span style={countBadge}>{section.rows.length}</span>
          </div>

          {section.rows.length === 0 ? (
            <div style={emptyState}>Sin elementos.</div>
          ) : (
            section.rows.slice(0, 5).map((row) => (
              <OperationItem key={`${section.title}-${row.id}`} row={row} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.56, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "warn" }) {
  return <span style={tone === "warn" ? tagWarn : tagNeutral}>{children}</span>;
}

const pageShell: CSSProperties = {
  padding: 20,
  display: "grid",
  gap: 18,
  background: "linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%)",
};

const heroCard: CSSProperties = {
  border: "1px solid #d8e0ea",
  background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)",
  borderRadius: 28,
  padding: 24,
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
  fontSize: 34,
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

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const primaryBtn: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid #142033",
  background: "#142033",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLink: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid #d9dee8",
  background: "#fff",
  color: "#142033",
  fontWeight: 900,
  textDecoration: "none",
};

const secondaryLinkSmall: CSSProperties = {
  ...secondaryLink,
  padding: "8px 10px",
  borderRadius: 10,
  fontSize: 12,
};

const compactBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #142033",
  fontWeight: 900,
  fontSize: 12,
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
  border: "1px solid #d9dee8",
  background: "rgba(255, 255, 255, 0.92)",
  borderRadius: 24,
  padding: 18,
  display: "grid",
  gap: 16,
  boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
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

const alertGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 10,
};

const criticalCard: CSSProperties = {
  ...sectionCard,
  border: "1px solid #fecaca",
  background: "linear-gradient(180deg, #fff4f4 0%, #fff 100%)",
};

const boardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  alignItems: "start",
};

const boardColumn: CSSProperties = {
  minWidth: 0,
  border: "1px solid #dde4ee",
  borderRadius: 20,
  padding: 14,
  display: "grid",
  gap: 12,
};

const columnHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const countBadge: CSSProperties = {
  minWidth: 32,
  height: 32,
  padding: "0 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20, 32, 51, 0.08)",
  fontWeight: 900,
  fontSize: 12,
  color: "#142033",
};

const itemCard: CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 16,
  padding: 12,
  background: "rgba(255,255,255,0.9)",
  display: "grid",
  gap: 10,
};

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
};

const subtlePanel: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fbff",
  fontSize: 12,
};

const warnBanner: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #f7d58d",
  background: "#fff8e8",
  color: "#8a5100",
  fontWeight: 900,
  fontSize: 12,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d7deea",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  color: "#6c819d",
  background: "rgba(255,255,255,0.45)",
};

const areaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
  alignItems: "start",
};

const areaCard: CSSProperties = {
  border: "1px solid #dde4ee",
  background: "#fff",
  borderRadius: 20,
  padding: 16,
  display: "grid",
  gap: 16,
};

const areaSectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  fontWeight: 900,
  fontSize: 15,
};

const saturationCard: CSSProperties = {
  ...sectionCard,
  border: "1px solid #f7d58d",
  background: "linear-gradient(180deg, #fff9ee 0%, #fff 100%)",
};

const saturationGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const saturationItem: CSSProperties = {
  border: "1px solid #f7d58d",
  background: "#fff",
  borderRadius: 16,
  padding: 12,
};

const alertWarn: CSSProperties = {
  border: "1px solid #f7d58d",
  background: "#fff8e8",
  borderRadius: 14,
  padding: 12,
};

const alertInfo: CSSProperties = {
  border: "1px solid #cfe0ff",
  background: "#f2f7ff",
  borderRadius: 14,
  padding: 12,
};

const criticalBox: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff",
  borderRadius: 14,
  padding: 12,
};

const neutralPill: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#36485f",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const warnPill: CSSProperties = {
  ...neutralPill,
  background: "#fff1d9",
  color: "#8a5100",
};

const criticalPill: CSSProperties = {
  ...neutralPill,
  background: "#ffe2e2",
  color: "#8f1d1d",
};

const tagNeutral: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#36485f",
  fontSize: 11,
  fontWeight: 800,
};

const tagWarn: CSSProperties = {
  ...tagNeutral,
  background: "#fff1d9",
  color: "#8a5100",
};
