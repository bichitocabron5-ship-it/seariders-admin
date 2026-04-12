"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState, type CSSProperties } from "react";
import ChannelCommissionRulesSection from "@/app/admin/channels/[id]/commissions/_components/ChannelCommissionRulesSection";

type ServiceOption = {
  id: string;
  durationMinutes: number;
  paxMax: number;
  basePriceCents: number;
};

type Service = {
  id: string;
  name: string;
  category: string;
  options: ServiceOption[];
};

type Rule = {
  id?: string;
  serviceId: string;
  commissionPct: number;
  isActive: boolean;
};

type OptionPriceRule = {
  optionId: string;
  useDefault: boolean;
  overridePriceEuros: string;
};

type Channel = {
  id: string;
  name: string;
  commissionEnabled: boolean;
  commissionBps: number | null;
};

function eurosFromCents(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function centsFromEurosStr(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export default function ChannelCommissionsClient({ channelId }: { channelId: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [optionPrices, setOptionPrices] = useState<Record<string, OptionPriceRule>>({});
  const [optionPricingAvailable, setOptionPricingAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCommissionRules() {
    const r = await fetch(`/api/admin/channels/${channelId}/commission-rules`, { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  function applyCommissionData(data: {
    channel?: Channel | null;
    services?: Service[];
    rules?: Array<{ id?: string; serviceId: string; commissionPct?: number; isActive?: boolean }>;
    optionPrices?: Array<{ optionId: string; priceCents?: number | null }>;
    optionPricingAvailable?: boolean;
  }) {
    setChannel(data.channel ?? null);
    setServices(data.services ?? []);
    setOptionPricingAvailable(data.optionPricingAvailable !== false);

    const nextRules: Record<string, Rule> = {};
    for (const rule of data.rules ?? []) {
      nextRules[rule.serviceId] = {
        id: rule.id,
        serviceId: rule.serviceId,
        commissionPct: rule.commissionPct ?? 0,
        isActive: rule.isActive ?? true,
      };
    }
    setRules(nextRules);

    const optionOverrides = new Map((data.optionPrices ?? []).map((row) => [row.optionId, Number(row.priceCents ?? 0)]));
    const nextOptionPrices: Record<string, OptionPriceRule> = {};
    for (const service of data.services ?? []) {
      for (const option of service.options ?? []) {
        const overrideCents = optionOverrides.get(option.id);
        nextOptionPrices[option.id] = {
          optionId: option.id,
          useDefault: overrideCents == null,
          overridePriceEuros: overrideCents == null ? eurosFromCents(option.basePriceCents) : eurosFromCents(overrideCents),
        };
      }
    }
    setOptionPrices(nextOptionPrices);
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
    return (channel.commissionBps ?? 0) / 100;
  }, [channel]);

  const summary = useMemo(() => {
    const activeRules = services.filter((service) => rules[service.id]?.isActive === true);
    const overriddenOptions = Object.values(optionPrices).filter((option) => !option.useDefault).length;
    return {
      total: services.length,
      withRule: activeRules.length,
      fallback: services.length - activeRules.length,
      optionOverrides: overriddenOptions,
    };
  }, [optionPrices, rules, services]);

  function setRule(serviceId: string, patch: Partial<Rule>) {
    setRules((prev) => {
      const cur = prev[serviceId] ?? { serviceId, commissionPct: 0, isActive: false };
      return { ...prev, [serviceId]: { ...cur, ...patch } };
    });
  }

  function setOptionRule(optionId: string, patch: Partial<OptionPriceRule>) {
    setOptionPrices((prev) => {
      const cur = prev[optionId] ?? { optionId, useDefault: true, overridePriceEuros: "0.00" };
      return { ...prev, [optionId]: { ...cur, ...patch } };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);

    const payloadRules: Rule[] = services.map((service) => {
      const rule = rules[service.id] ?? { serviceId: service.id, commissionPct: 0, isActive: false };
      return {
        serviceId: service.id,
        commissionPct: Math.max(0, Math.min(100, Math.trunc(rule.commissionPct ?? 0))),
        isActive: rule.isActive === true,
      };
    });

    const payloadOptionPrices = Object.values(optionPrices).map((option) => ({
      optionId: option.optionId,
      useDefault: option.useDefault,
      priceCents: option.useDefault ? null : centsFromEurosStr(option.overridePriceEuros),
    }));

    if (!optionPricingAvailable && payloadOptionPrices.some((row) => !row.useDefault)) {
      setError("El PVP por canal no estÃ¡ disponible en esta base de datos. Falta aplicar la migraciÃ³n.");
      setSaving(false);
      return;
    }

    if (payloadOptionPrices.some((row) => !row.useDefault && (row.priceCents == null || row.priceCents < 0))) {
      setError("Revisa los PVP por canal. Hay importes inválidos.");
      setSaving(false);
      return;
    }

    const r = await fetch(`/api/admin/channels/${channelId}/commission-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: payloadRules, optionPrices: payloadOptionPrices }),
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
          <h1 style={titleStyle}>Reglas comerciales por servicio</h1>
          <p style={subtitleStyle}>
            Canal: <strong>{channel?.name ?? "..."}</strong>. La comisión sigue funcionando por servicio y, además,
            puedes definir un PVP comercial por duración/pax para cada opción.
          </p>
          <div style={helperStyle}>
            El PVP por canal es informativo para seguimiento comercial y liquidaciones. No modifica el precio real que
            se cobra en reserva.
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
        <article style={summaryCard}>
          <div style={summaryLabel}>PVP canal</div>
          <div style={summaryValue}>{summary.optionOverrides}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <ChannelCommissionRulesSection
        services={services}
        rules={rules}
        optionPrices={optionPrices}
        optionPricingAvailable={optionPricingAvailable}
        fallbackPct={fallbackPct}
        loading={loading}
        onSetRule={setRule}
        onSetOptionRule={setOptionRule}
      />
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

const errorStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "pre-wrap",
};
