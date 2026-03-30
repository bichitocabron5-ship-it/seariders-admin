"use client";

import type { CSSProperties } from "react";

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

type Props = {
  services: Service[];
  rules: Record<string, Rule>;
  fallbackPct: number;
  loading: boolean;
  onSetRule: (serviceId: string, patch: Partial<Rule>) => void;
};

export default function ChannelCommissionRulesSection({
  services,
  rules,
  fallbackPct,
  loading,
  onSetRule,
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
        <div style={{ fontWeight: 950 }}>Configuración de comisiones por servicio</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Activa una regla solo cuando el porcentaje de ese servicio deba ser distinto al fallback del canal.
        </div>
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
                      const next = e.target.checked;
                      onSetRule(service.id, {
                        isActive: next,
                        commissionPct: next
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
                      onSetRule(service.id, {
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
