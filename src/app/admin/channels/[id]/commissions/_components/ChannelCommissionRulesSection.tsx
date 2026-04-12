"use client";

import type { CSSProperties } from "react";

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

type Props = {
  services: Service[];
  rules: Record<string, Rule>;
  optionPrices: Record<string, OptionPriceRule>;
  optionPricingAvailable: boolean;
  fallbackPct: number;
  loading: boolean;
  onSetRule: (serviceId: string, patch: Partial<Rule>) => void;
  onSetOptionRule: (optionId: string, patch: Partial<OptionPriceRule>) => void;
};

function eurosFromCents(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

export default function ChannelCommissionRulesSection({
  services,
  rules,
  optionPrices,
  optionPricingAvailable,
  fallbackPct,
  loading,
  onSetRule,
  onSetOptionRule,
}: Props) {
  if (loading) {
    return (
      <section style={panelStyle}>
        <div style={{ padding: 18, opacity: 0.7 }}>Cargando...</div>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Comision y PVP por servicio</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          En cada opcion puedes usar el PVP de Admin &gt; Precios o definir un PVP comercial especifico del canal.
        </div>
        {!optionPricingAvailable ? (
          <div style={warningStyle}>
            El bloque de PVP canal esta en solo lectura porque la migracion de base de datos todavia no esta aplicada.
          </div>
        ) : null}
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        {services.map((service) => {
          const rule = rules[service.id] ?? { serviceId: service.id, commissionPct: 0, isActive: false };
          const pct = rule.commissionPct ?? 0;
          const active = rule.isActive === true;

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
                      ? `Este servicio usa una comision propia del ${pct}%`
                      : `Este servicio hereda la comision base del canal (${fallbackPct.toFixed(2)}%)`}
                  </div>
                </div>

                <div style={resultBox}>
                  Resultado comision: <strong>{active ? `${pct}%` : `${fallbackPct.toFixed(2)}%`}</strong>
                </div>
              </div>

              <div style={controlsGrid}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => {
                      const next = e.target.checked;
                      onSetRule(service.id, {
                        isActive: next,
                        commissionPct: next ? (rules[service.id]?.commissionPct ?? Math.round(fallbackPct)) : (rules[service.id]?.commissionPct ?? 0),
                      });
                    }}
                  />
                  Activar comision propia
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Comision del servicio (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={pct}
                    onChange={(e) =>
                      onSetRule(service.id, {
                        commissionPct: Math.max(0, Math.min(100, Number(e.target.value || 0))),
                      })
                    }
                    style={inputStyle}
                    disabled={!active}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {service.options.map((option) => {
                  const optionRule = optionPrices[option.id] ?? {
                    optionId: option.id,
                    useDefault: true,
                    overridePriceEuros: (option.basePriceCents / 100).toFixed(2),
                  };

                  return (
                    <div key={option.id} style={optionRow}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {option.durationMinutes} min · {option.paxMax} pax
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          PVP Admin: <strong>{eurosFromCents(option.basePriceCents)}</strong>
                        </div>
                      </div>

                      <div style={optionControlsGrid}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
                          <input
                            type="radio"
                            checked={optionRule.useDefault}
                            onChange={() => onSetOptionRule(option.id, { useDefault: true })}
                            disabled={!optionPricingAvailable}
                          />
                          Usar Admin
                        </label>

                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
                          <input
                            type="radio"
                            checked={!optionRule.useDefault}
                            onChange={() =>
                              onSetOptionRule(option.id, {
                                useDefault: false,
                                overridePriceEuros:
                                  optionRule.overridePriceEuros || (option.basePriceCents / 100).toFixed(2),
                              })
                            }
                            disabled={!optionPricingAvailable}
                          />
                          Usar PVP canal
                        </label>

                        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                          PVP canal (EUR)
                          <input
                            type="text"
                            inputMode="decimal"
                            value={optionRule.overridePriceEuros}
                            onChange={(e) => onSetOptionRule(option.id, { overridePriceEuros: e.target.value })}
                            style={inputStyle}
                            disabled={optionRule.useDefault || !optionPricingAvailable}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

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

const warningStyle: CSSProperties = {
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 700,
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

const optionControlsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "center",
};

const optionRow: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  background: "#f8fafc",
  display: "grid",
  gridTemplateColumns: "minmax(180px, 240px) 1fr",
  gap: 12,
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ea",
  outline: "none",
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
