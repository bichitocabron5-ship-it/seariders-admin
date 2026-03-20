// src/app/admin/channels/[id]/commissions/ui.tsx
"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState, type CSSProperties } from "react";

type Service = {
  id: string;
  name: string;
  category: string;
};

type Rule = {
  id?: string;
  serviceId: string;
  commissionPct: number;
  isActive: boolean;
};

type Channel = {
  id: string;
  name: string;
  commissionEnabled: boolean;
  commissionBps: number | null;
};

export default function ChannelCommissionsClient({ channelId }: { channelId: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCommissionRules() {
    const r = await fetch(`/api/admin/channels/${channelId}/commission-rules`, {
      cache: "no-store",
    });

    if (!r.ok) {
      throw new Error(await r.text());
    }

    return r.json();
  }

  function applyCommissionData(data: {
    channel?: Channel | null;
    services?: Service[];
    rules?: Array<{ id?: string; serviceId: string; commissionPct?: number; isActive?: boolean }>;
  }) {
    setChannel(data.channel ?? null);
    setServices(data.services ?? []);
    const map: Record<string, Rule> = {};
    for (const rr of data.rules ?? []) {
      map[rr.serviceId] = {
        id: rr.id,
        serviceId: rr.serviceId,
        commissionPct: rr.commissionPct ?? 0,
        isActive: rr.isActive ?? true,
      };
    }
    setRules(map);
  }

  const load = useEffectEvent(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommissionRules();
      applyCommissionData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando reglas");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, [channelId]);

  const fallbackPct = useMemo(() => {
    if (!channel?.commissionEnabled) return 0;
    const bps = channel.commissionBps ?? 0;
    return bps / 100;
  }, [channel]);

  const summary = useMemo(() => {
    const activeRules = services.filter((service) => rules[service.id]?.isActive === true);
    return {
      total: services.length,
      withRule: activeRules.length,
      fallback: services.length - activeRules.length,
    };
  }, [rules, services]);

  function setRule(serviceId: string, patch: Partial<Rule>) {
    setRules((prev) => {
      const cur = prev[serviceId] ?? { serviceId, commissionPct: 0, isActive: false };
      return {
        ...prev,
        [serviceId]: { ...cur, ...patch },
      };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);

    const payload: Rule[] = services.map((service) => {
      const rr = rules[service.id] ?? { serviceId: service.id, commissionPct: 0, isActive: false };
      return {
        serviceId: service.id,
        commissionPct: Math.max(0, Math.min(100, Math.trunc(rr.commissionPct ?? 0))),
        isActive: rr.isActive === true,
      };
    });

    const r = await fetch(`/api/admin/channels/${channelId}/commission-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: payload }),
    });

    if (!r.ok) {
      setError(await r.text());
      setSaving(false);
      return;
    }

    try {
      const data = await fetchCommissionRules();
      applyCommissionData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error recargando reglas");
    }
    setSaving(false);
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Canales</div>
          <h1 style={titleStyle}>Reglas por servicio</h1>
          <p style={subtitleStyle}>
            Canal: <strong>{channel?.name ?? "..."}</strong>. Cuando una regla esta desactivada, el servicio usa el
            fallback del canal: <strong>{channel?.commissionEnabled ? `${fallbackPct.toFixed(2)}%` : "0.00%"}</strong>.
          </p>
          <div style={helperStyle}>
            Extras, tiempo extra y actividad extra no comisionan y no aparecen en esta configuracion.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/channels" style={ghostBtn}>
            Volver a canales
          </Link>
          <button type="button" onClick={() => void save()} disabled={saving || loading} style={darkBtn}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Servicios</div>
          <div style={summaryValue}>{summary.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Con regla activa</div>
          <div style={summaryValue}>{summary.withRule}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Usando fallback</div>
          <div style={summaryValue}>{summary.fallback}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {loading ? (
        <section style={panelStyle}>
          <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
        </section>
      ) : (
        <section style={panelStyle}>
          <div style={panelHeader}>
            <div style={{ fontWeight: 950 }}>Configuracion de comisiones por servicio</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Activa una regla solo cuando el porcentaje de ese servicio deba ser distinto al fallback del canal.
            </div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 12 }}>
            {services.map((service) => {
              const rr = rules[service.id] ?? { serviceId: service.id, commissionPct: 0, isActive: false };
              const pct = rr.commissionPct ?? 0;
              const active = rr.isActive === true;

              return (
                <article key={service.id} style={rowCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{service.name}</div>
                        <span style={categoryPill}>{service.category}</span>
                        <span style={{ ...statusPill, ...(active ? statusOn : statusOff) }}>
                          {active ? "Regla activa" : "Fallback canal"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {active
                          ? `Este servicio usa una regla propia del ${pct}%`
                          : `Este servicio hereda el fallback del canal (${fallbackPct.toFixed(2)}%)`}
                      </div>
                    </div>

                    <div style={resultBox}>
                      {active ? (
                        <span>
                          Resultado: <strong>{pct}%</strong>
                        </span>
                      ) : (
                        <span>
                          Resultado: <strong>{fallbackPct.toFixed(2)}%</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={controlsGrid}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setRule(service.id, {
                            isActive: on,
                            commissionPct: on
                              ? (rules[service.id]?.commissionPct ?? Math.round(fallbackPct))
                              : (rules[service.id]?.commissionPct ?? 0),
                          });
                        }}
                      />
                      Activar regla propia
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Porcentaje de la regla
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={pct}
                        onChange={(e) =>
                          setRule(service.id, {
                            commissionPct: Math.max(0, Math.min(100, Number(e.target.value || 0))),
                          })
                        }
                        style={inputStyle}
                        disabled={!active}
                        title={!active ? "Activa la regla para editar el porcentaje" : ""}
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div style={footerNoteStyle}>
        Consejo operativo: para canales como <strong>Brutal</strong>, activa solo los servicios que realmente
        comisionan y deja el resto heredando el fallback.
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#2563eb",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const helperStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const panelHeader: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  display: "grid",
  gap: 4,
};

const rowCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "grid",
  gap: 12,
};

const controlsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ea",
  outline: "none",
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const darkBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
};

const categoryPill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
};

const statusPill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid transparent",
};

const statusOn: CSSProperties = {
  background: "#ecfeff",
  borderColor: "#99f6e4",
  color: "#0f766e",
};

const statusOff: CSSProperties = {
  background: "#f8fafc",
  borderColor: "#dbe4ea",
  color: "#64748b",
};

const resultBox: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  fontSize: 13,
  color: "#334155",
  fontWeight: 700,
};

const errorStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "pre-wrap",
};

const footerNoteStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};
