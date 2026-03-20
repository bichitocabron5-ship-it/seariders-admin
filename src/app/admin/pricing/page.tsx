"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Service = { id: string; name: string; category: string };
type Option = {
  id: string;
  serviceId: string;
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
};

type PriceRow = {
  id: string;
  serviceId: string;
  optionId: string | null;
  durationMin: number | null;
  basePriceCents: number;
  validFrom: string;
  validTo: string | null;
};

type CatalogResponse = {
  servicesMain: Service[];
  servicesExtra: Service[];
  options: Option[];
  prices: {
    byOption: Record<string, PriceRow>;
    byDuration: Record<string, PriceRow>;
  };
};

function eurosFromCents(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function centsFromEurosStr(v: string) {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export default function AdminPricingPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);

    const r = await fetch("/api/admin/pricing/catalog", { cache: "no-store" });
    if (!r.ok) {
      setError(await r.text());
      setLoading(false);
      return;
    }

    const json = (await r.json()) as CatalogResponse;
    setData(json);

    const nextDraft: Record<string, string> = {};
    for (const k of Object.keys(json.prices.byOption || {})) {
      const price = json.prices.byOption[k];
      nextDraft[`opt:${k}`] = eurosFromCents(price.basePriceCents);
    }
    for (const k of Object.keys(json.prices.byDuration || {})) {
      const price = json.prices.byDuration[k];
      nextDraft[`dur:${k}`] = eurosFromCents(price.basePriceCents);
    }
    setDraft(nextDraft);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const optionsByService = useMemo(() => {
    const map: Record<string, Option[]> = {};
    for (const option of data?.options ?? []) {
      if (!map[option.serviceId]) map[option.serviceId] = [];
      map[option.serviceId].push(option);
    }
    return map;
  }, [data?.options]);

  const stats = useMemo(() => {
    return {
      mainCount: data?.servicesMain.length ?? 0,
      extraCount: data?.servicesExtra.length ?? 0,
      optionCount: data?.options.length ?? 0,
    };
  }, [data]);

  async function setPrice(payload: {
    serviceId: string;
    optionId?: string | null;
    durationMin?: number | null;
    basePriceCents: number;
  }) {
    setError(null);

    const r = await fetch("/api/admin/pricing/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      setError(await r.text());
      return false;
    }
    return true;
  }

  async function saveOptionPrice(serviceId: string, optionId: string) {
    if (!data) return;

    const key = `${serviceId}:${optionId}`;
    const draftKey = `opt:${key}`;
    const cents = centsFromEurosStr(draft[draftKey] ?? "");
    if (cents == null) {
      setError("Precio invalido (usa formato 150.00)");
      return;
    }

    setSavingKey(draftKey);
    const ok = await setPrice({ serviceId, optionId, basePriceCents: cents });
    setSavingKey(null);

    if (ok) await load();
  }

  async function saveExtraPrice(serviceId: string) {
    const key = `${serviceId}:null`;
    const draftKey = `dur:${key}`;
    const cents = centsFromEurosStr(draft[draftKey] ?? "");
    if (cents == null) {
      setError("Precio invalido (usa formato 15.00)");
      return;
    }

    setSavingKey(draftKey);
    const ok = await setPrice({ serviceId, durationMin: null, basePriceCents: cents });
    setSavingKey(null);

    if (ok) await load();
  }

  if (loading) {
    return <div style={{ padding: 16, fontFamily: "system-ui" }}>Cargando precios...</div>;
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Comercial</div>
          <h1 style={titleStyle}>Precios</h1>
          <p style={subtitleStyle}>
            Gestion del PVP base con historico por fecha de vigencia. Cada guardado crea una nueva version y la
            comision siempre se calcula sobre el precio base.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button type="button" onClick={() => void load()} style={darkBtn}>
            Refrescar
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Servicios principales</div>
          <div style={summaryValue}>{stats.mainCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Opciones activas</div>
          <div style={summaryValue}>{stats.optionCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Extras</div>
          <div style={summaryValue}>{stats.extraCount}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Servicios principales</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Edita el PVP base por opcion. Cada cambio genera una nueva entrada en historico.
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          {(data?.servicesMain ?? []).map((service) => {
            const options = optionsByService[service.id] ?? [];

            return (
              <article key={service.id} style={serviceCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{service.name}</div>
                      <span style={categoryPill}>{service.category}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Configura el precio vigente por opcion y consulta el historico si necesitas trazabilidad.
                    </div>
                  </div>
                </div>

                {options.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#64748b" }}>Sin opciones activas. Crea opciones en catalogo.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {options.map((option) => {
                      const key = `${service.id}:${option.id}`;
                      const price = data?.prices.byOption?.[key];
                      const current = price?.basePriceCents ?? 0;
                      const from = price?.validFrom ? new Date(price.validFrom).toLocaleString("es-ES") : "-";
                      const draftKey = `opt:${key}`;
                      const isSaving = savingKey === draftKey;

                      return (
                        <div key={option.id} style={optionCard}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>
                              {option.durationMinutes} min · hasta {option.paxMax} pax
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                              Contratado: {option.contractedMinutes} min
                            </div>
                          </div>

                          <div style={priceMetaGrid}>
                            <div>
                              <div style={metaLabel}>Precio actual</div>
                              <div style={metaValue}>{eurosFromCents(current)} EUR</div>
                            </div>
                            <div>
                              <div style={metaLabel}>Vigente desde</div>
                              <div style={{ ...metaValue, fontSize: 13 }}>{from}</div>
                            </div>
                          </div>

                          <div style={editorGrid}>
                            <label style={fieldLabel}>
                              Nuevo precio (EUR)
                              <input
                                value={draft[draftKey] ?? ""}
                                onChange={(e) => setDraft((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                                style={inputStyle}
                                placeholder="150.00"
                              />
                            </label>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => void saveOptionPrice(service.id, option.id)}
                                style={darkBtn}
                              >
                                {isSaving ? "Guardando..." : "Guardar"}
                              </button>

                              <Link
                                href={`/admin/pricing/history?serviceId=${service.id}&optionId=${option.id}`}
                                style={ghostBtn}
                              >
                                Ver historico
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Extras</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Precios base para servicios extra sin opcion asociada.
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          {(data?.servicesExtra ?? []).map((service) => {
            const key = `${service.id}:null`;
            const price = data?.prices.byDuration?.[key];
            const current = price?.basePriceCents ?? 0;
            const from = price?.validFrom ? new Date(price.validFrom).toLocaleString("es-ES") : "-";
            const draftKey = `dur:${key}`;
            const isSaving = savingKey === draftKey;

            return (
              <article key={service.id} style={optionCard}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{service.name}</div>
                    <span style={categoryPill}>{service.category}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Servicio extra sin opcion de duracion asociada.</div>
                </div>

                <div style={priceMetaGrid}>
                  <div>
                    <div style={metaLabel}>Precio actual</div>
                    <div style={metaValue}>{eurosFromCents(current)} EUR</div>
                  </div>
                  <div>
                    <div style={metaLabel}>Vigente desde</div>
                    <div style={{ ...metaValue, fontSize: 13 }}>{from}</div>
                  </div>
                </div>

                <div style={editorGrid}>
                  <label style={fieldLabel}>
                    Nuevo precio (EUR)
                    <input
                      value={draft[draftKey] ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                      style={inputStyle}
                      placeholder="15.00"
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveExtraPrice(service.id)}
                      style={darkBtn}
                    >
                      {isSaving ? "Guardando..." : "Guardar"}
                    </button>

                    <Link href={`/admin/pricing/history?serviceId=${service.id}&optionId=null`} style={ghostBtn}>
                      Ver historico
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div style={footerNoteStyle}>
        Aqui guardamos <strong>PVP base</strong>. Descuentos y promociones se gestionan aparte y no alteran la base de
        comision.
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

const serviceCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "grid",
  gap: 12,
};

const optionCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const priceMetaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const editorGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 320px) auto",
  gap: 10,
  alignItems: "end",
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#334155",
};

const metaLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const metaValue: CSSProperties = {
  marginTop: 4,
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ea",
  outline: "none",
  width: "100%",
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
