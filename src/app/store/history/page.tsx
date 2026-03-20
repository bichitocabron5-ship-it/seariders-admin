"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Alert, Button, Card, Input, Pill, Select, Stat, styles } from "@/components/ui";

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
  return `/store/create?migrateFrom=${reservationId}`;
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
      setError(e instanceof Error ? e.message : "Error cargando historico");
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
            <h1 style={heroTitle}>Historico de reservas</h1>
            <div style={heroSubtitle}>
              Consulta devoluciones, incidencias, cobros y retenciones en una vista ordenada y alineada con la operativa
              de tienda.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/store" style={secondaryLink}>
              Volver a Store
            </a>
            <button onClick={load} style={primaryButton} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <div style={statsGrid}>
          <Stat label="Reservas listadas" value={summary.total} />
          <Stat label="Con incidencia" value={summary.withIncidents} />
          <Stat label="Fianza retenida" value={summary.depositHeld} />
          <Stat label="Servicio cobrado" value={euros(summary.serviceChargedCents)} />
          <Stat label="Pendiente total" value={euros(summary.pendingCents)} />
        </div>
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

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card
        title="Resultados"
        right={
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            {loading ? "Cargando..." : `${rows.length} reservas`}
          </div>
        }
      >
        {loading ? (
          <div style={emptyState}>Cargando historico...</div>
        ) : rows.length === 0 ? (
          <div style={emptyState}>No hay resultados para los filtros actuales.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...styles.table, minWidth: 1400 }}>
              <thead>
                <tr>
                  <th style={styles.th}>Reserva</th>
                  <th style={styles.th}>Servicio</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Cobro</th>
                  <th style={styles.th}>Fianza</th>
                  <th style={styles.th}>Incidencias</th>
                  <th style={styles.th}>Canal</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const statusUi = statusTone(row.status);
                  const incidentCount = row.incidents.length;

                  return (
                    <tr key={row.id} style={{ verticalAlign: "top" }}>
                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{row.customerName || "Sin nombre"}</div>
                          <div style={mutedStack}>
                            <span>{row.customerCountry || "-"}</span>
                            <span>{row.source || "Origen no indicado"}</span>
                          </div>
                          <div style={detailBlock}>
                            <div>
                              <strong>Actividad</strong>
                              <div>{dt(row.scheduledTime || row.activityDate)}</div>
                            </div>
                            <div>
                              <strong>Devuelta</strong>
                              <div>{dt(row.arrivalAt)}</div>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>{row.serviceName || "Servicio"}</div>
                          <div style={mutedText}>{row.serviceCategory || "Categoria sin indicar"}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill>{row.durationMinutes ? `${row.durationMinutes} min` : "Sin duracion"}</Pill>
                            <Pill>Cant {row.quantity ?? 0}</Pill>
                            <Pill>PAX {row.pax ?? 0}</Pill>
                            {row.isLicense ? <Pill>Licencia</Pill> : null}
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <span
                            style={{
                              ...badgeBase,
                              background: statusUi.bg,
                              borderColor: statusUi.border,
                              color: statusUi.color,
                            }}
                          >
                            {row.status}
                          </span>
                          <div style={mutedText}>
                            Formalizada: {row.formalizedAt ? dt(row.formalizedAt) : "No"}
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={moneyValue}>{euros(countPaidServiceCents(row))}</div>
                          <div style={mutedText}>Total servicio {euros(row.totalToChargeCents)}</div>
                          <div style={{ color: countPendingServiceCents(row) > 0 ? "#b45309" : "#166534", fontWeight: 800 }}>
                            Pendiente {euros(countPendingServiceCents(row))}
                          </div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={moneyValue}>
                            {euros(row.paidDepositCents)} / {euros(row.depositCents)}
                          </div>
                          <div style={{ color: row.depositHeld ? "#b91c1c" : "#166534", fontWeight: 900 }}>
                            {row.depositHeld ? "Retenida" : "Sin bloqueo"}
                          </div>
                          {row.depositHoldReason ? <div style={mutedText}>{row.depositHoldReason}</div> : null}
                        </div>
                      </td>

                      <td style={cell}>
                        {incidentCount === 0 ? (
                          <div style={mutedText}>Sin incidencias</div>
                        ) : (
                          <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Pill bg="#fff7ed" border="#fed7aa">{incidentCount} incidencias</Pill>
                              {row.depositHeld ? <Pill bg="#fff1f2" border="#fecdd3">Fianza retenida</Pill> : null}
                            </div>

                            {row.incidents.map((incident) => {
                              const tone = incidentTone(incident.level);
                              return (
                                <details key={incident.id} style={incidentCard}>
                                  <summary style={incidentSummary}>
                                    <span
                                      style={{
                                        ...badgeBase,
                                        background: tone.bg,
                                        borderColor: tone.border,
                                        color: tone.color,
                                      }}
                                    >
                                      {incident.level}
                                    </span>
                                    <span style={{ fontWeight: 800 }}>{incident.type}</span>
                                    <span style={mutedText}>{incident.status}</span>
                                  </summary>

                                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                                    {incident.description ? <div style={{ color: "#0f172a" }}>{incident.description}</div> : null}
                                    {incident.notes ? <div style={mutedText}>Notas: {incident.notes}</div> : null}
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {incident.isOpen ? <Pill bg="#eff6ff" border="#bfdbfe">Abierta</Pill> : <Pill>Cerrada</Pill>}
                                      {incident.retainDeposit ? (
                                        <Pill bg="#fff1f2" border="#fecdd3">
                                          Retiene {euros(incident.retainDepositCents)}
                                        </Pill>
                                      ) : null}
                                    </div>
                                    <div style={mutedText}>Registrada: {dt(incident.createdAt)}</div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 800 }}>{row.channelName || "-"}</div>
                        </div>
                      </td>

                      <td style={cell}>
                        <div style={{ display: "grid", gap: 8, minWidth: 150 }}>
                          <a href={reservationHref(row.id)} style={actionLink}>
                            Ver ficha
                          </a>

                          {row.incidents.some((incident) => incident.maintenanceEventId) ? (
                            <a
                              href={mechanicsEventHref(row.incidents.find((incident) => incident.maintenanceEventId)!)}
                              style={actionLink}
                            >
                              Ver evento
                            </a>
                          ) : null}

                          {row.incidents.length > 0 ? (
                            <a href={mechanicsDetailHref(row.incidents[0])} style={actionLink}>
                              Ver mecanica
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const page: CSSProperties = {
  padding: 20,
  maxWidth: 1760,
  margin: "0 auto",
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
};

const heroCard: CSSProperties = {
  border: "1px solid #d8e0ea",
  background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)",
  borderRadius: 26,
  padding: 22,
  display: "grid",
  gap: 18,
  boxShadow: "0 18px 40px rgba(20, 32, 51, 0.08)",
};

const heroHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#58708f",
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#142033",
};

const heroSubtitle: CSSProperties = {
  fontSize: 14,
  color: "#51627b",
  maxWidth: 760,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const secondaryLink: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  textDecoration: "none",
};

const primaryButton: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
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
