"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type Service = { id: string; name: string; category: string };
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
  pricesByDuration: Record<string, PriceRow>;
  draft: Record<string, string>;
  savingKey: string | null;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveExtraPrice: (serviceId: string) => void | Promise<void>;
  eurosFromCents: (cents: number) => string;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
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

export default function PricingExtrasSection({
  services,
  pricesByDuration,
  draft,
  savingKey,
  setDraft,
  saveExtraPrice,
  eurosFromCents,
  panelStyle,
  panelHeader,
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
        <div style={{ fontWeight: 950 }}>Extras</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Precios base para servicios extra sin opción asociada.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        {services.map((service) => {
          const key = `${service.id}:null:STANDARD`;
          const price = pricesByDuration[key];
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
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Servicio extra sin opción de duración asociada.
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
                    Ver histórico
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
