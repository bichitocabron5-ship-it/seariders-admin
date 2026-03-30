"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

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

type Props = {
  services: Service[];
  optionsByService: Record<string, Option[]>;
  pricesByOption: Record<string, PriceRow>;
  draft: Record<string, string>;
  savingKey: string | null;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveOptionPrice: (serviceId: string, optionId: string) => void | Promise<void>;
  eurosFromCents: (cents: number) => string;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  serviceCard: CSSProperties;
  optionCard: CSSProperties;
  priceMetaGrid: CSSProperties;
  editorGrid: CSSProperties;
  fieldLabel: CSSProperties;
  metaLabel: CSSProperties;
  metaValue: CSSProperties;
  inputStyle: CSSProperties;
  ghostBtn: CSSProperties;
  darkBtn: CSSProperties;
  categoryPill: CSSProperties;
};

export default function PricingMainServicesSection({
  services,
  optionsByService,
  pricesByOption,
  draft,
  savingKey,
  setDraft,
  saveOptionPrice,
  eurosFromCents,
  panelStyle,
  panelHeader,
  serviceCard,
  optionCard,
  priceMetaGrid,
  editorGrid,
  fieldLabel,
  metaLabel,
  metaValue,
  inputStyle,
  ghostBtn,
  darkBtn,
  categoryPill,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Servicios principales</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Edita el PVP base por opción. Cada cambio genera una nueva entrada en histórico.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        {services.map((service) => {
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
                    Configura el precio vigente por opción y consulta el histórico si necesitas trazabilidad.
                  </div>
                </div>
              </div>

              {options.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>Sin opciones activas. Crea opciones en catálogo.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {options.map((option) => {
                    const key = `${service.id}:${option.id}`;
                    const price = pricesByOption[key];
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

                            <Link href={`/admin/pricing/history?serviceId=${service.id}&optionId=${option.id}`} style={ghostBtn}>
                              Ver histórico
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
  );
}
