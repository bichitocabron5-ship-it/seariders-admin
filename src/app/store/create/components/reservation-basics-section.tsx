// src/app/store/create/components/reservation-basics-section.tsx
"use client";

import React from "react";
import { PhoneWithCountryField } from "@/components/customer-inputs";
import type { CountryOption } from "@/lib/countries";
import type { Channel, JetskiLicenseMode, Option, PackPreview, PricingTier, ServiceMain } from "../types";

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #d0d9e4",
  background: "#fff",
  minHeight: 48,
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 700 };
const captionStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 800 };
const subCardStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "rgba(255,255,255,0.78)",
  display: "grid",
  gap: 14,
};
const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#64748b",
};

export type ReservationBasicsSectionProps = {
  values: {
    firstName: string;
    lastName: string;
    customerPhone: string;
    customerEmail: string;
    customerCountry: string;
    customerAddress: string;
    customerPostalCode: string;
    customerDocType: string;
    customerDocNumber: string;
    marketingSource: string;
    boothNote?: string | null;
    category: string;
    serviceId: string;
    optionId: string;
    channelId: string;
    quantity: number;
    pax: number;
    companions: number;
    jetskiLicenseMode: JetskiLicenseMode;
    pricingTier: PricingTier;
  };
  flags: {
    isEditMode: boolean;
    customerCountryRequired: boolean;
    customerAddressRequired: boolean;
    customerDocumentRequired: boolean;
    isVoucherFormalizeFlow: boolean;
    selectedCategory: string;
    isJetskiSelection: boolean;
  };
  lists: {
    countryOptions: CountryOption[];
    selectedCountryOpt: CountryOption | null;
    categoriesMain: string[];
    servicesMainFiltered: ServiceMain[];
    packPreview: PackPreview | null;
    filteredOptions: Option[];
    selectedOpt: Option | null;
    channels: Channel[];
  };
  handlers: {
    onFirstNameChange: (value: string) => void;
    onLastNameChange: (value: string) => void;
    onCustomerPhoneChange: (value: string) => void;
    onCustomerEmailChange: (value: string) => void;
    onCustomerCountryChange: (value: string) => void;
    onCustomerAddressChange: (value: string) => void;
    onCustomerPostalCodeChange: (value: string) => void;
    onCustomerDocTypeChange: (value: string) => void;
    onCustomerDocNumberChange: (value: string) => void;
    onMarketingSourceChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onServiceChange: (value: string) => void;
    onOptionChange: (value: string) => void;
    onChannelChange: (value: string) => void;
    onQuantityChange: (value: number) => void;
    onPaxChange: (value: number) => void;
    onCompanionsChange: (value: number) => void;
    onJetskiLicenseModeChange: (value: JetskiLicenseMode) => void;
  };
  validation?: {
    showErrors: boolean;
    firstName?: string | null;
    lastName?: string | null;
    customerPhone?: string | null;
  };
};

export function ReservationBasicsSection({ values, flags, lists, handlers, validation }: ReservationBasicsSectionProps) {
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  };
  const customerPrimaryGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "start",
  };
  const customerSecondaryGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "start",
  };
  const fullRow: React.CSSProperties = { gridColumn: "1 / -1" };
  const withErrorStyle = (hasError?: string | null): React.CSSProperties =>
    hasError
      ? { ...inputStyle, border: "1px solid #ef4444", background: "#fff5f5" }
      : inputStyle;

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ padding: 18, border: "1px solid #e2e8f0", borderRadius: 20, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0369a1" }}>Cliente</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Cliente y reserva</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Datos de cliente, servicio, duración, canal y cantidades.</div>
          </div>

          {values.boothNote ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid #cbd5e1",
                background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#475569" }}>
                Nota de Booth
              </div>
              <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>{values.boothNote}</div>
            </div>
          ) : null}

          <div style={subCardStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={sectionEyebrowStyle}>Ficha del cliente</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Datos básicos del cliente para la reserva. La documentación legal se completará en contratos si la actividad lo requiere.
              </div>
            </div>

            <div style={customerPrimaryGridStyle}>
              <label style={labelStyle}>
                <span>Nombre *</span>
                <input
                  value={values.firstName}
                  onChange={(e) => handlers.onFirstNameChange(e.target.value)}
                  required={!flags.isEditMode}
                  disabled={flags.isEditMode}
                  style={{ ...withErrorStyle(validation?.showErrors ? validation?.firstName : null), opacity: flags.isEditMode ? 0.7 : 1 }}
                />
                {validation?.showErrors && validation?.firstName ? <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{validation.firstName}</div> : null}
              </label>

              <label style={labelStyle}>
                <span>Apellidos</span>
                <input
                  value={values.lastName}
                  onChange={(e) => handlers.onLastNameChange(e.target.value)}
                  required={false}
                  disabled={flags.isEditMode}
                  style={{ ...withErrorStyle(validation?.showErrors ? validation?.lastName : null), opacity: flags.isEditMode ? 0.7 : 1 }}
                  placeholder="Opcional en reserva"
                />
                {validation?.showErrors && validation?.lastName ? <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>{validation.lastName}</div> : null}
              </label>
            </div>

            <div style={customerSecondaryGridStyle}>
              <PhoneWithCountryField
                label="Teléfono *"
                country={values.customerCountry}
                phone={values.customerPhone}
                onCountryChange={handlers.onCustomerCountryChange}
                onPhoneChange={handlers.onCustomerPhoneChange}
                countryOptions={lists.countryOptions}
                inputStyle={inputStyle}
                required
                phonePlaceholder="Ej: 612345678"
                containerStyle={{ minWidth: 0, gridColumn: "span 2" }}
                error={validation?.showErrors ? validation?.customerPhone : null}
              />

              <label style={labelStyle}>
                <span>Email</span>
                <input
                  value={values.customerEmail}
                  onChange={(e) => handlers.onCustomerEmailChange(e.target.value)}
                  style={inputStyle}
                  placeholder="cliente@email.com"
                />
              </label>

            </div>

            <div style={{ ...gridStyle, gridTemplateColumns: "minmax(240px, 420px)" }}>
              <label style={labelStyle}>
                <span>¿Cómo nos conoció?</span>
                <select
                  value={values.marketingSource}
                  onChange={(e) => handlers.onMarketingSourceChange(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecciona...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Recomendación">Recomendación</option>
                  <option value="Google">Google</option>
                  <option value="Radio">Radio</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Youtube">Youtube</option>
                  <option value="Flyers">Flyers</option>
                  <option value="Otros">Otros</option>
                  <option value="Hoteles">Hoteles</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 18, border: "1px solid #e2e8f0", borderRadius: 20, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>Actividad</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Configuración de actividad</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Selecciona categoría, servicio, duración, canal y aforo.</div>
          </div>

        <div style={subCardStyle}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={sectionEyebrowStyle}>Operativa de la reserva</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Parámetros comerciales y operativos de la actividad.</div>
          </div>

        <div style={gridStyle}>
          <label style={labelStyle}>
            <span>Categoría</span>
            <select disabled={flags.isVoucherFormalizeFlow} value={values.category} onChange={(e) => handlers.onCategoryChange(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              {lists.categoriesMain.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Servicio</span>
            <select value={values.serviceId} onChange={(e) => handlers.onServiceChange(e.target.value)} disabled={flags.isVoucherFormalizeFlow} style={inputStyle}>
              <option value="" disabled>Selecciona servicio...</option>
              {lists.servicesMainFiltered.map((s) => (
                <option key={s.id} value={s.id}>{s.category ? `${s.category} | ` : ""}{s.name}</option>
              ))}
            </select>
          </label>

          {flags.selectedCategory === "PACK" && lists.packPreview?.items?.length ? (
            <div style={{ ...fullRow, padding: 14, border: "1px solid #e2e8f0", borderRadius: 16, background: "#f8fafc", display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Incluye</div>
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {lists.packPreview.items.map((it, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#334155" }}>
                    <span>{it.service?.name ?? "Servicio"}{it.option?.durationMinutes ? ` | ${it.option.durationMinutes} min` : ""}</span>
                    <b>x{it.quantity ?? 1}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label style={labelStyle}>
            <span>Duración</span>
            <select value={values.optionId} onChange={(e) => handlers.onOptionChange(e.target.value)} disabled={flags.isVoucherFormalizeFlow} style={inputStyle}>
              <option value="" disabled>{values.serviceId ? "Selecciona duración..." : "Selecciona servicio primero"}</option>
              {lists.filteredOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {(o.durationMinutes ?? "-")} min - {(o.paxMax ?? "-")} pax ({
                    (() => {
                      const shownPrice =
                        flags.isJetskiSelection && values.pricingTier === "RESIDENT"
                          ? o.residentPriceCents
                          : o.standardPriceCents ?? o.basePriceCents;
                      return shownPrice == null ? "-" : euros(shownPrice);
                    })()
                  })
                  {(() => {
                    const shownPrice =
                      flags.isJetskiSelection && values.pricingTier === "RESIDENT"
                        ? o.residentPriceCents
                        : o.standardPriceCents ?? o.basePriceCents;
                    return shownPrice == null ? " | SIN PRECIO" : "";
                  })()}
                </option>
              ))}
            </select>
            {lists.selectedOpt && (lists.selectedOpt.basePriceCents == null || lists.selectedOpt.hasPrice === false) ? (
              <div style={{ fontSize: 12, marginTop: 4, color: "#b91c1c", fontWeight: 700 }}>
                Esta opción no tiene precio vigente (Admin &gt; Precios).
              </div>
            ) : null}
          </label>

          <label style={labelStyle}>
            <span>Canal</span>
            <select value={values.channelId} onChange={(e) => handlers.onChannelChange(e.target.value)} style={inputStyle}>
              {lists.channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Cantidad</span>
            <input type="number" min={1} value={values.quantity} onChange={(e) => handlers.onQuantityChange(Number(e.target.value))} disabled={flags.isVoucherFormalizeFlow} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            <span>PAX</span>
            <input type="number" min={1} value={values.pax} onChange={(e) => handlers.onPaxChange(Number(e.target.value))} disabled={flags.isVoucherFormalizeFlow} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            <span>Acompañantes</span>
            <input type="number" min={0} value={values.companions} onChange={(e) => handlers.onCompanionsChange(Math.max(0, Number(e.target.value)))} disabled={flags.isVoucherFormalizeFlow} style={inputStyle} />
            <div style={captionStyle}>Personas que vienen pero no realizan actividad.</div>
          </label>

          {flags.isJetskiSelection ? (
            <label style={labelStyle}>
              <span>Modo licencia / llave</span>
              <select
                value={values.jetskiLicenseMode}
                onChange={(e) => handlers.onJetskiLicenseModeChange(e.target.value as JetskiLicenseMode)}
                disabled={flags.isVoucherFormalizeFlow}
                style={inputStyle}
              >
                <option value="NONE">Sin licencia</option>
                <option value="GREEN_LIMITED">Licencia · llave verde</option>
                <option value="YELLOW_UNLIMITED">Licencia · llave amarilla</option>
              </select>
              <div style={captionStyle}>
                {values.jetskiLicenseMode === "GREEN_LIMITED"
                  ? "Contrato de licencia con tarifa residente."
                  : values.jetskiLicenseMode === "YELLOW_UNLIMITED"
                    ? "Contrato de licencia con tarifa estándar de licencia."
                    : "Sin contrato de licencia."}
              </div>
            </label>
          ) : null}
        </div>
        </div>
      </div>
    </section>
  );
}
