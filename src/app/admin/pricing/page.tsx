"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import PricingMainServicesSection from "./_components/PricingMainServicesSection";
import PricingExtrasSection from "./_components/PricingExtrasSection";

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
  pricingTier: "STANDARD" | "RESIDENT";
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
    pricingTier?: "STANDARD" | "RESIDENT";
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

  async function saveOptionPrice(serviceId: string, optionId: string, pricingTier: "STANDARD" | "RESIDENT") {
    if (!data) return;

    const key = `${serviceId}:${optionId}:${pricingTier}`;
    const draftKey = `opt:${key}`;
    const cents = centsFromEurosStr(draft[draftKey] ?? "");
    if (cents == null) {
      setError("Precio inválido (usa formato 150.00)");
      return;
    }

    setSavingKey(draftKey);
    const ok = await setPrice({ serviceId, optionId, pricingTier, basePriceCents: cents });
    setSavingKey(null);

    if (ok) await load();
  }

  async function saveExtraPrice(serviceId: string) {
    const key = `${serviceId}:null:STANDARD`;
    const draftKey = `dur:${key}`;
    const cents = centsFromEurosStr(draft[draftKey] ?? "");
    if (cents == null) {
      setError("Precio inválido (usa formato 15.00)");
      return;
    }

    setSavingKey(draftKey);
    const ok = await setPrice({ serviceId, durationMin: null, pricingTier: "STANDARD", basePriceCents: cents });
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
            Gestión del PVP base con histórico por fecha de vigencia. Cada guardado crea una nueva versión y la
            comisión siempre se calcula sobre el precio base.
          </p>
        </div>

        <div style={opsStyles.actionGrid}>
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

      <PricingMainServicesSection
        services={data?.servicesMain ?? []}
        optionsByService={optionsByService}
        pricesByOption={data?.prices.byOption ?? {}}
        draft={draft}
        savingKey={savingKey}
        setDraft={setDraft}
        saveOptionPrice={saveOptionPrice}
        eurosFromCents={eurosFromCents}
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        serviceCard={serviceCard}
        optionCard={optionCard}
        priceMetaGrid={priceMetaGrid}
        editorGrid={editorGrid}
        fieldLabel={fieldLabel}
        metaLabel={metaLabel}
        metaValue={metaValue}
        inputStyle={inputStyle}
        ghostBtn={ghostBtn}
        darkBtn={darkBtn}
        categoryPill={categoryPill}
      />

      <PricingExtrasSection
        services={data?.servicesExtra ?? []}
        pricesByDuration={data?.prices.byDuration ?? {}}
        draft={draft}
        savingKey={savingKey}
        setDraft={setDraft}
        saveExtraPrice={saveExtraPrice}
        eurosFromCents={eurosFromCents}
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        optionCard={optionCard}
        priceMetaGrid={priceMetaGrid}
        editorGrid={editorGrid}
        fieldLabel={fieldLabel}
        metaLabel={metaLabel}
        metaValue={metaValue}
        inputStyle={inputStyle}
        ghostBtn={ghostBtn}
        darkBtn={darkBtn}
        categoryPill={categoryPill}
      />

      <div style={footerNoteStyle}>
        Aquí guardamos <strong>PVP base</strong>. Descuentos y promociones se gestionan aparte y no alteran la base de
        comisión.
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1200px, 100%)",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  ...opsStyles.heroCard,
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
  ...opsStyles.heroTitle,
  margin: 0,
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
  ...opsStyles.metricCard,
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
  ...opsStyles.sectionCard,
  padding: 0,
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
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
  outline: "none",
  width: "100%",
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  color: "#0f172a",
};

const darkBtn: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
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
