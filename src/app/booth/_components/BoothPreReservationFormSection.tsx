"use client";

import Select from "react-select";
import type { CountryOption } from "@/lib/countries";

type Service = { id: string; name: string; category: string; code?: string | null; isExternalActivity?: boolean | null };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; basePriceCents: number };
type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";
type Channel = {
  id: string;
  name: string;
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  showDiscountPolicyInStore?: boolean | null;
  showDiscountPolicyInBooth?: boolean | null;
  discountResponsibility?: "COMPANY" | "PROMOTER" | "SHARED" | null;
  promoterDiscountShareBps?: number | null;
};

type Props = {
  cardStyle: React.CSSProperties;
  darkBtn: React.CSSProperties;
  fieldStyle: React.CSSProperties;
  firstName: string;
  customerCountry: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  channelId: string;
  paymentMethod: PayMethod;
  category: string;
  categories: string[];
  services: Service[];
  servicesFiltered: Service[];
  options: Option[];
  optionsForService: Option[];
  channels: Channel[];
  selectedService: Service | null;
  selectedChannel: Channel | null;
  isExternalCharge: boolean;
  selectedCountryOpt: CountryOption | null;
  countryOptions: CountryOption[];
  isJetski: boolean;
  discountEuros: string;
  boothNote: string;
  maxManualDiscountCents: number;
  baseTotalCents: number;
  discountCentsRaw: number;
  discountCentsClamped: number;
  finalTotalCents: number;
  commissionPct: number;
  commissionCents: number;
  netAfterCommissionCents: number;
  showDiscountPolicy: boolean;
  discountResponsibility: "COMPANY" | "PROMOTER" | "SHARED";
  promoterDiscountSharePct: string;
  promoterDiscountCents: number;
  companyDiscountCents: number;
  commissionBaseCents: number;
  promoterNominalPct: number;
  promoterEffectivePct: number;
  euros: (cents: number) => string;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  setFirstName: (value: string) => void;
  setCustomerCountry: (value: string) => void;
  setServiceId: (value: string) => void;
  setOptionId: (value: string) => void;
  setQuantity: (value: number) => void;
  setPax: (value: number) => void;
  setChannelId: (value: string) => void;
  setPaymentMethod: (value: PayMethod) => void;
  setCategory: (value: string) => void;
  setDiscountEuros: (value: string) => void;
  setDiscountResponsibility: (value: "COMPANY" | "PROMOTER" | "SHARED") => void;
  setPromoterDiscountSharePct: (value: string) => void;
  setBoothNote: (value: string) => void;
};

export default function BoothPreReservationFormSection({
  cardStyle,
  darkBtn,
  fieldStyle,
  firstName,
  customerCountry,
  serviceId,
  optionId,
  quantity,
  pax,
  channelId,
  paymentMethod,
  category,
  categories,
  services,
  servicesFiltered,
  options,
  optionsForService,
  channels,
  selectedService,
  selectedChannel,
  isExternalCharge,
  selectedCountryOpt,
  countryOptions,
  isJetski,
  discountEuros,
  boothNote,
  maxManualDiscountCents,
  baseTotalCents,
  discountCentsRaw,
  discountCentsClamped,
  finalTotalCents,
  commissionPct,
  commissionCents,
  netAfterCommissionCents,
  showDiscountPolicy,
  discountResponsibility,
  promoterDiscountSharePct,
  promoterDiscountCents,
  companyDiscountCents,
  commissionBaseCents,
  promoterNominalPct,
  promoterEffectivePct,
  euros,
  onSubmit,
  setFirstName,
  setCustomerCountry,
  setServiceId,
  setOptionId,
  setQuantity,
  setPax,
  setChannelId,
  setPaymentMethod,
  setCategory,
  setDiscountEuros,
  setDiscountResponsibility,
  setPromoterDiscountSharePct,
  setBoothNote,
}: Props) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>{isExternalCharge ? "Cobro externo" : "Pre-reserva"}</h2>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          {isExternalCharge
            ? "Registro directo de cobro con comision para actividad externa."
            : "Alta rapida para carpa con precio, descuento y canal."}
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Nombre
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={fieldStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div>Pais</div>
          <Select<CountryOption, false>
            instanceId="booth-country"
            inputId="booth-country"
            options={countryOptions}
            value={selectedCountryOpt}
            onChange={(opt) => setCustomerCountry((opt?.value ?? customerCountry).toUpperCase())}
            placeholder="Escribe para buscar..."
          />
        </div>

        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              const list = next ? services.filter((service) => service.category === next) : services;
              const firstService = list[0] ?? null;
              setServiceId(firstService?.id ?? "");
              const firstOption = options.find((option) => option.serviceId === (firstService?.id ?? "")) ?? null;
              setOptionId(firstOption?.id ?? "");
            }}
            style={fieldStyle}
          >
            <option value="">(todas)</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Servicio
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={fieldStyle}>
            {servicesFiltered.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Duracion
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)} style={fieldStyle}>
            {optionsForService.map((option) => (
              <option key={option.id} value={option.id}>
                {option.durationMinutes} min · max {option.paxMax} pax · {euros(option.basePriceCents)}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            Cantidad (motos)
            <input
              type="number"
              min={1}
              max={4}
              value={quantity}
              disabled={!isJetski}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={fieldStyle}
            />
          </label>
          <label>
            PAX
            <input
              type="number"
              min={1}
              max={20}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              style={fieldStyle}
            />
          </label>
        </div>

        <label>
          Descuento opcional (EUR)
          <input
            inputMode="decimal"
            value={discountEuros}
            onChange={(e) => setDiscountEuros(e.target.value)}
            placeholder="0.00"
            style={fieldStyle}
          />
        </label>

        {selectedChannel && showDiscountPolicy ? (
          <>
            <label>
              Quien asume el descuento
              <select
                value={discountResponsibility}
                onChange={(e) => setDiscountResponsibility(e.target.value as "COMPANY" | "PROMOTER" | "SHARED")}
                style={fieldStyle}
              >
                <option value="COMPANY">Empresa</option>
                <option value="PROMOTER">Promotor</option>
                <option value="SHARED">Compartido</option>
              </select>
            </label>

            {discountResponsibility === "SHARED" ? (
              <label>
                Parte del promotor (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={promoterDiscountSharePct}
                  onChange={(e) => setPromoterDiscountSharePct(e.target.value)}
                  style={fieldStyle}
                />
              </label>
            ) : null}
          </>
        ) : null}

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Max descuento manual: <b>{euros(maxManualDiscountCents)}</b> (30% sobre {euros(baseTotalCents)})
          {discountCentsRaw > maxManualDiscountCents ? (
            <span style={{ marginLeft: 8, color: "#b91c1c" }}>limitado a {euros(maxManualDiscountCents)}</span>
          ) : null}
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #dbeafe",
            background: "#f8fbff",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 800 }}>Resumen antes de registrar</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            Precio base: <strong>{euros(baseTotalCents)}</strong>
          </div>
          <div style={{ fontSize: 13, color: discountCentsClamped > 0 ? "#0f172a" : "#64748b" }}>
            Descuento aplicado: <strong>-{euros(discountCentsClamped)}</strong>
          </div>
          <div style={{ fontSize: 15, color: "#0f172a", fontWeight: 900 }}>
            {isExternalCharge ? "Importe final del cobro" : "Precio final de la reserva"}: {euros(finalTotalCents)}
          </div>
          {selectedChannel ? (
            commissionPct > 0 ? (
              <>
                <div style={{ fontSize: 13, color: "#334155" }}>
                  Comision estimada para Seariders ({selectedChannel.name} · {commissionPct.toFixed(2)}%):{" "}
                  <strong>{euros(commissionCents)}</strong>
                </div>
                <div style={{ fontSize: 13, color: "#334155" }}>
                  Base comisionable: <strong>{euros(commissionBaseCents)}</strong>
                </div>
                {showDiscountPolicy ? (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Descuento asumido por promotor: <strong>{euros(promoterDiscountCents)}</strong> · empresa:{" "}
                    <strong>{euros(companyDiscountCents)}</strong>
                  </div>
                ) : null}
                {showDiscountPolicy && promoterDiscountCents > 0 ? (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Promotor: <strong>{promoterNominalPct.toFixed(2)}%</strong> nominal →{" "}
                    <strong>{promoterEffectivePct.toFixed(2)}%</strong> efectivo
                  </div>
                ) : null}
                <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>
                  Neto estimado a liquidar al partner: {euros(netAfterCommissionCents)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                El canal seleccionado no tiene comision configurada para esta actividad.
              </div>
            )
          ) : null}
          {isJetski && quantity > 1 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>
              Precio final por moto: <strong>{euros(Math.round(finalTotalCents / quantity))}</strong>
            </div>
          ) : null}
          {discountCentsRaw > maxManualDiscountCents ? (
            <div style={{ fontSize: 12, color: "#b91c1c" }}>
              El descuento introducido supera el maximo permitido y se aplicara el importe limitado.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {isExternalCharge
                ? "Se registrara un cobro directo en caja, sin generar codigo ni reserva."
                : "Este sera el total que se guardara al crear la reserva."}
            </div>
          )}
        </div>

        <label>
          {selectedService?.isExternalActivity ? "Canal de comision externa" : "Canal opcional"}
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} style={fieldStyle}>
            <option value="">(ninguno)</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        {selectedService?.isExternalActivity ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Solo se muestran partners externos habilitados para liquidar comision en Booth.
          </div>
        ) : null}

        {isExternalCharge ? (
          <label>
            Metodo de pago
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PayMethod)} style={fieldStyle}>
              <option value="CARD">Tarjeta</option>
              <option value="CASH">Efectivo</option>
              <option value="BIZUM">Bizum</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </label>
        ) : null}

        <label style={{ display: "grid", gap: 6 }}>
          <span>{isExternalCharge ? "Nota interna (opcional)" : "Nota para tienda (opcional)"}</span>
          <textarea
            value={boothNote}
            onChange={(e) => setBoothNote(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Ej: cliente viene con bebe, atencion en ingles, espera a otro grupo..."
            style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }}
          />
        </label>

        <button type="submit" style={{ ...darkBtn, width: "100%" }}>
          {isExternalCharge ? "Registrar cobro con comision" : "Crear y generar codigo"}
        </button>
      </form>
    </section>
  );
}
