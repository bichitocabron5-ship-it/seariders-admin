"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { Alert, Button, Card, Input, Select, styles } from "@/components/ui";
import { opsStyles } from "@/components/ops-ui";

type HistoryRow = {
  id: string;
  boothCode: string | null;
  status: string;
  activityDate: string;
  scheduledTime: string | null;
  arrivedStoreAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerCountry: string | null;
  quantity: number | null;
  pax: number | null;
  totalPriceCents: number;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  servicePaidCents: number;
  servicePendingCents: number;
  depositPaidCents: number;
  paymentsCount: number;
  lastPaymentAt: string | null;
};

function euros(cents: number | null | undefined) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayMadridYMD() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return { bg: "#ecfdf5", border: "#bbf7d0", color: "#166534" };
    case "WAITING":
      return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    case "CANCELED":
      return { bg: "#f8fafc", border: "#cbd5e1", color: "#475569" };
    default:
      return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
  }
}

export default function BoothHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(todayMadridYMD());
  const [dateTo, setDateTo] = useState(todayMadridYMD());

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "ALL") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("take", "100");
    return params.toString();
  }, [q, status, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booth/reservations/history?${queryString}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el histórico");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.charged += Number(row.servicePaidCents ?? 0);
        acc.pending += Number(row.servicePendingCents ?? 0);
        acc.pax += Number(row.pax ?? 0);
        return acc;
      },
      { total: 0, charged: 0, pending: 0, pax: 0 }
    );
  }, [rows]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={heroHeaderStyle}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={eyebrowStyle}>Carpa</div>
            <h1 style={titleStyle}>Histórico de reservas</h1>
            <div style={subtitleStyle}>
              Consulta por día qué salió desde carpa, cuánto se cobró y qué quedó pendiente en cada reserva.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/booth" style={secondaryLinkStyle}>
              Volver a Carpa
            </Link>
            <Button variant="primary" onClick={() => void load()} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </Button>
          </div>
        </div>

        <div style={heroStatsStyle}>
          <div style={heroStatStyle}>
            <div style={heroStatLabelStyle}>Reservas</div>
            <div style={heroStatValueStyle}>{summary.total}</div>
          </div>
          <div style={heroStatStyle}>
            <div style={heroStatLabelStyle}>Cobrado</div>
            <div style={heroStatValueStyle}>{euros(summary.charged)}</div>
          </div>
          <div style={heroStatStyle}>
            <div style={heroStatLabelStyle}>Pendiente</div>
            <div style={heroStatValueStyle}>{euros(summary.pending)}</div>
          </div>
          <div style={heroStatStyle}>
            <div style={heroStatLabelStyle}>PAX</div>
            <div style={heroStatValueStyle}>{summary.pax}</div>
          </div>
        </div>
      </section>

      <Card
        title="Filtros"
        right={
          <Button
            onClick={() => {
              const today = todayMadridYMD();
              setQ("");
              setStatus("ALL");
              setDateFrom(today);
              setDateTo(today);
            }}
          >
            Hoy
          </Button>
        }
      >
        <div style={filtersGrid}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Cliente</span>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del cliente" />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Estado</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="SCHEDULED">Programada</option>
              <option value="WAITING">Pendiente</option>
              <option value="READY_FOR_PLATFORM">Lista para plataforma</option>
              <option value="IN_SEA">En mar</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELED">Cancelada</option>
            </Select>
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Desde</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Hasta</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
      </Card>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card
        title="Reservas"
        right={<div style={mutedStyle}>{loading ? "Cargando..." : `${rows.length} resultados`}</div>}
      >
        {loading ? (
          <div style={emptyStyle}>Cargando histórico...</div>
        ) : rows.length === 0 ? (
          <div style={emptyStyle}>No hay reservas para los filtros actuales.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...styles.table, minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={styles.th}>Reserva</th>
                  <th style={styles.th}>Servicio</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Cobrado</th>
                  <th style={styles.th}>Pendiente</th>
                  <th style={styles.th}>Pagos</th>
                  <th style={styles.th}>Tienda</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const tone = statusTone(row.status);
                  return (
                    <tr key={row.id}>
                      <td style={styles.td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{row.customerName || "Sin nombre"}</div>
                          <div style={mutedStyle}>
                            {row.customerCountry || "-"} · Código {row.boothCode || "-"}
                          </div>
                          <div style={mutedStyle}>ID {row.id.slice(-6)}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 800 }}>{row.serviceName || "Servicio"}</div>
                          <div style={mutedStyle}>
                            {row.durationMinutes ? `${row.durationMinutes} min` : "Sin duración"} · Cant {row.quantity ?? 0} · PAX {row.pax ?? 0}
                          </div>
                          <div style={mutedStyle}>{row.serviceCategory || "Sin categoría"}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>{formatDateTime(row.scheduledTime || row.activityDate)}</div>
                          <div style={mutedStyle}>Creada {formatDateTime(row.createdAt)}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "5px 10px",
                            borderRadius: 999,
                            border: `1px solid ${tone.border}`,
                            background: tone.bg,
                            color: tone.color,
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{euros(row.servicePaidCents)}</div>
                          <div style={mutedStyle}>Total {euros(row.totalPriceCents)}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 900, color: row.servicePendingCents > 0 ? "#b45309" : "#166534" }}>
                          {euros(row.servicePendingCents)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>{row.paymentsCount} movimientos</div>
                          <div style={mutedStyle}>Fianza neta {euros(row.depositPaidCents)}</div>
                          <div style={mutedStyle}>Último {formatDateTime(row.lastPaymentAt)}</div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 800 }}>
                          {row.arrivedStoreAt ? formatDateTime(row.arrivedStoreAt) : "No recibida"}
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

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1480px, 100%)",
  display: "grid",
  gap: 18,
};

const heroStyle: CSSProperties = {
  borderRadius: 24,
  padding: "clamp(18px, 3vw, 28px)",
  display: "grid",
  gap: 18,
  color: "#ecfeff",
  background:
    "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%), radial-gradient(circle at right bottom, rgba(45, 212, 191, 0.12), transparent 28%), linear-gradient(135deg, #082f49 0%, #0f766e 55%, #052e2b 100%)",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
};

const heroHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#99f6e4",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(2rem, 5vw, 3rem)",
  lineHeight: 1,
  fontWeight: 950,
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  color: "#ccfbf1",
  maxWidth: 760,
};

const secondaryLinkStyle: CSSProperties = {
  ...styles.btn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  background: "rgba(255,255,255,0.92)",
};

const heroStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const heroStatStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(153, 246, 228, 0.25)",
  background: "rgba(255,255,255,0.08)",
  padding: "12px 14px",
  display: "grid",
  gap: 4,
};

const heroStatLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#99f6e4",
};

const heroStatValueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#ecfeff",
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const mutedStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const emptyStyle: CSSProperties = {
  padding: "24px 8px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};
