"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BoothRow = {
  id: string;
  boothCode: string | null;
  arrivedStoreAt: string | null;
  createdAt: string;
  customerName: string;
  customerCountry: string;
  quantity: number;
  pax: number;
  totalPriceCents: number;
  service: { name: string };
  option: { durationMinutes: number };
  taxiboatDepartedAt?: string | null;
  taxiboatTripId?: string | null;
  taxiboatBoat?: string | null;
  taxiboatTripNo?: number | null;
};

type EnCaminoGroup = {
  key: string;
  tripId: string | null | undefined;
  boat: string;
  tripNo: number | null;
  departedAt: string | null | undefined;
  items: BoothRow[];
  paxTotal: number;
};

function euros(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function todayMadridYMD() {
  const tz = "Europe/Madrid";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export default function StoreBoothPage() {
  const [rows, setRows] = useState<BoothRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [marking, setMarking] = useState(false);
  const [lastMarkedId, setLastMarkedId] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/store/booth/today", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Error cargando carpa"));
    } finally {
      setLoading(false);
    }
  }

function hhmm(d?: string | null) {
  if (!d) return "--:--";
  return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function boatLabel(boat?: string | null) {
  if (!boat) return "Taxiboat";
  if (boat === "TAXIBOAT_1") return "Nazca";
  if (boat === "TAXIBOAT_2") return "Nico";
  return boat;
}

  async function markReceived() {
    const boothCode = code.trim().toUpperCase();
    if (!boothCode) return;

    setError(null);
    setMarking(true);

    try {
      const r = await fetch("/api/store/booth/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boothCode }),
      });

      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      const reservationId = data.reservationId ?? null;

      setLastMarkedId(reservationId);
      setCode("");
      await load();

      if (!reservationId) return;

      if (data.alreadyFormalized) {
        router.push(`/store?reservationId=${reservationId}&boothCode=${encodeURIComponent(boothCode)}`);
        return;
      }

      const day = todayMadridYMD();
      router.push(`/store/create?migrateFrom=${reservationId}&date=${day}&mode=today&boothCode=${encodeURIComponent(boothCode)}`);
    } catch (e: unknown) {
      setError(errorMessage(e, "Error marcando recibido"));
    } finally {
      setMarking(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  const enCamino = useMemo(
    () => rows.filter((r) => r.taxiboatDepartedAt && !r.arrivedStoreAt),
    [rows]
  );
  const recibidas = useMemo(() => rows.filter((r) => !!r.arrivedStoreAt), [rows]);
  const paxEnCamino = useMemo(
    () => enCamino.reduce((total, row) => total + Number(row.pax ?? 0), 0),
    [enCamino]
  );
  const importeEnCamino = useMemo(
    () => enCamino.reduce((total, row) => total + Number(row.totalPriceCents ?? 0), 0),
    [enCamino]
  );

  const groups = useMemo(
    () =>
      Object.values(
        enCamino.reduce<Record<string, EnCaminoGroup>>((acc, r) => {
          const k = r.taxiboatTripId ?? "NO_TRIP";
          if (!acc[k]) {
            acc[k] = {
              key: k,
              tripId: r.taxiboatTripId,
              boat: boatLabel(r.taxiboatBoat),
              tripNo: r.taxiboatTripNo ?? null,
              departedAt: r.taxiboatDepartedAt,
              items: [],
              paxTotal: 0,
            };
          }
          acc[k].items.push(r);
          acc[k].paxTotal += Number(r.pax ?? 0);
          return acc;
        }, {})
      ),
    [enCamino]
  );

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={eyebrowStyle}>Recepcion de carpa</div>
          <h1 style={titleStyle}>Store / Booth</h1>
          <p style={subtitleStyle}>
            Validacion de codigos, seguimiento de viajes en curso y traspaso ordenado a tienda.
          </p>
          <div style={heroMetaRow}>
            <HeroBadge label="En camino" value={String(enCamino.length)} />
            <HeroBadge label="PAX en ruta" value={String(paxEnCamino)} />
            <HeroBadge label="Recibidas" value={String(recibidas.length)} />
          </div>
        </div>

        <div style={heroActions}>
          <button type="button" onClick={() => void load()} disabled={loading} style={ghostBtn}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
          <Link href="/store" style={ghostLinkBtn}>
            Volver a store
          </Link>
        </div>
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={statsGrid}>
        <StatCard
          title="Clientes en camino"
          value={String(enCamino.length)}
          detail={`${groups.length} viajes activos`}
        />
        <StatCard
          title="PAX en ruta"
          value={String(paxEnCamino)}
          detail={euros(importeEnCamino)}
        />
        <StatCard
          title="Recepciones cerradas"
          value={String(recibidas.length)}
          detail={lastMarkedId ? "Ultima recepcion registrada" : "Sin recepciones recientes"}
        />
      </div>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionTitle}>Validar codigo de carpa</div>
            <div style={sectionSubtitle}>
              Al marcar recibido, el cliente se abre en tienda o migra al flujo de formalizacion.
            </div>
          </div>
        </div>

        <div style={validatorGrid}>
          <label style={fieldStyle}>
            Codigo
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PO-1234-567"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void markReceived();
                }
              }}
            />
          </label>

          <button type="button" onClick={() => void markReceived()} disabled={marking} style={primaryBtn}>
            {marking ? "Marcando..." : "Marcar recibido"}
          </button>
        </div>
      </section>

      <div style={columnsStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionTitle}>En camino</div>
              <div style={sectionSubtitle}>Agrupado por taxiboat para ver carga y prioridad.</div>
            </div>
            <div style={pillStyle}>{groups.length} viajes</div>
          </div>

          {enCamino.length === 0 ? (
            <div style={emptyStateStyle}>No hay nadie en camino ahora mismo.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {groups.map((g) => (
                <article key={g.key} style={groupCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>
                        {boatLabel(g.boat)}
                        {g.tripNo ? ` / Viaje ${g.tripNo}` : ""}
                      </div>
                      <div style={subtleTextStyle}>
                        Salida {hhmm(g.departedAt)} / {g.items.length} reservas / {g.paxTotal} pax
                      </div>
                    </div>
                    <div style={tripBadgeStyle}>Activa</div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {g.items.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          ...itemCardStyle,
                          background: r.id === lastMarkedId ? "linear-gradient(180deg, #ecfccb 0%, #ffffff 100%)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontWeight: 900, fontSize: 17 }}>{r.customerName}</div>
                            <div style={subtleTextStyle}>
                              {r.service?.name} / {r.option?.durationMinutes} min / {r.quantity} motos / {r.pax} pax
                            </div>
                            <div style={subtleTextStyle}>
                              Pais {r.customerCountry} / Total {euros(r.totalPriceCents)}
                            </div>
                          </div>
                          <div style={codeBadgeStyle}>{r.boothCode ?? "Sin codigo"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionTitle}>Recibidas</div>
              <div style={sectionSubtitle}>Control de entradas ya traspasadas a tienda.</div>
            </div>
            <div style={pillStyle}>{recibidas.length} cierres</div>
          </div>

          {recibidas.length === 0 ? (
            <div style={emptyStateStyle}>Todavia no se ha recibido ninguna reserva.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {recibidas.map((r) => (
                <article key={r.id} style={itemCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 900, fontSize: 17 }}>{r.customerName}</div>
                      <div style={subtleTextStyle}>
                        Recibido a las {hhmm(r.arrivedStoreAt)} / {r.service?.name}
                      </div>
                    </div>
                    <div style={codeBadgeStyle}>{r.boothCode ?? "Sin codigo"}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HeroBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroBadgeStyle}>
      <div style={heroBadgeLabel}>{label}</div>
      <div style={heroBadgeValue}>{value}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={statCardStyle}>
      <div style={heroBadgeLabel}>{title}</div>
      <div style={statValueStyle}>{value}</div>
      <div style={subtleTextStyle}>{detail}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1380,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
  background:
    "radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(251, 191, 36, 0.12), transparent 24%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 28,
  padding: 22,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #eff6ff 100%)",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0369a1",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#475569",
  maxWidth: 720,
};

const heroMetaRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const heroBadgeStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "rgba(255,255,255,0.78)",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  minWidth: 120,
};

const heroBadgeLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748b",
};

const heroBadgeValue: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const heroActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const statCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  padding: 16,
  display: "grid",
  gap: 6,
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  background: "#fff",
  padding: 18,
  display: "grid",
  gap: 16,
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.06)",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 21,
  fontWeight: 950,
  color: "#0f172a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const validatorGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 12,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontSize: 14,
};

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const pillStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 999,
  padding: "7px 12px",
  background: "#f8fafc",
  fontWeight: 900,
  fontSize: 12,
  color: "#334155",
};

const groupCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 14,
};

const tripBadgeStyle: React.CSSProperties = {
  border: "1px solid #bae6fd",
  background: "#f0f9ff",
  color: "#0369a1",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 12,
  height: "fit-content",
};

const itemCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const codeBadgeStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 900,
  fontSize: 12,
  height: "fit-content",
};

const subtleTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  color: "#64748b",
  background: "#f8fafc",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  color: "#0f172a",
  cursor: "pointer",
};

const ghostLinkBtn: React.CSSProperties = {
  ...ghostBtn,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const errorBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
