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
  pricingTier: "STANDARD" | "RESIDENT";
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
  saveOptionPrice: (serviceId: string, optionId: string, pricingTier: "STANDARD" | "RESIDENT") => void | Promise<void>;
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
                    const standardKey = `${service.id}:${option.id}:STANDARD`;
                    const residentKey = `${service.id}:${option.id}:RESIDENT`;
                    const standardPrice = pricesByOption[standardKey];
                    const residentPrice = pricesByOption[residentKey];
                    const current = standardPrice?.basePriceCents ?? 0;
                    const from = standardPrice?.validFrom ? new Date(standardPrice.validFrom).toLocaleString("es-ES") : "-";
                    const standardDraftKey = `opt:${standardKey}`;
                    const residentDraftKey = `opt:${residentKey}`;
                    const isSavingStandard = savingKey === standardDraftKey;
                    const isSavingResident = savingKey === residentDraftKey;

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
                              value={draft[standardDraftKey] ?? ""}
                              onChange={(e) => setDraft((prev) => ({ ...prev, [standardDraftKey]: e.target.value }))}
                              style={inputStyle}
                              placeholder="150.00"
                            />
                          </label>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                            <button
                              type="button"
                              disabled={isSavingStandard}
                              onClick={() => void saveOptionPrice(service.id, option.id, "STANDARD")}
                              style={darkBtn}
                            >
                              {isSavingStandard ? "Guardando..." : "Guardar"}
                            </button>

                            <Link href={`/admin/pricing/history?serviceId=${service.id}&optionId=${option.id}`} style={ghostBtn}>
                              Ver histórico
                            </Link>
                          </div>
                        </div>

                        {service.category === "JETSKI" ? (
                          <div style={editorGrid}>
                            <label style={fieldLabel}>
                              Tarifa residente / llave verde (EUR)
                              <input
                                value={draft[residentDraftKey] ?? ""}
                                onChange={(e) => setDraft((prev) => ({ ...prev, [residentDraftKey]: e.target.value }))}
                                style={inputStyle}
                                placeholder="90.00"
                              />
                            </label>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                              <button
                                type="button"
                                disabled={isSavingResident}
                                onClick={() => void saveOptionPrice(service.id, option.id, "RESIDENT")}
                                style={darkBtn}
                              >
                                {isSavingResident ? "Guardando..." : "Guardar residente"}
                              </button>
                              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                                Actual: {eurosFromCents(residentPrice?.basePriceCents ?? 0)} EUR
                              </div>
                            </div>
                          </div>
                        ) : null}
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
