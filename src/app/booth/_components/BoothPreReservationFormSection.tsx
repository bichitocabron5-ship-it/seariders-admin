"use client";

import Select from "react-select";
import type { CountryOption } from "@/lib/countries";

type Service = { id: string; name: string; category: string; code?: string | null };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; basePriceCents: number };
type Channel = { id: string; name: string };

type Props = {
  cardStyle: React.CSSProperties;
  darkBtn: React.CSSProperties;
  fieldStyle: React.CSSProperties;
  firstName: string;
  lastName: string;
  customerCountry: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  channelId: string;
  category: string;
  categories: string[];
  services: Service[];
  servicesFiltered: Service[];
  options: Option[];
  optionsForService: Option[];
  channels: Channel[];
  selectedCountryOpt: CountryOption | null;
  countryOptions: CountryOption[];
  isJetski: boolean;
  discountEuros: string;
  maxManualDiscountCents: number;
  baseTotalCents: number;
  discountCentsRaw: number;
  euros: (cents: number) => string;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setCustomerCountry: (value: string) => void;
  setServiceId: (value: string) => void;
  setOptionId: (value: string) => void;
  setQuantity: (value: number) => void;
  setPax: (value: number) => void;
  setChannelId: (value: string) => void;
  setCategory: (value: string) => void;
  setDiscountEuros: (value: string) => void;
};

export default function BoothPreReservationFormSection({
  cardStyle,
  darkBtn,
  fieldStyle,
  firstName,
  lastName,
  customerCountry,
  serviceId,
  optionId,
  quantity,
  pax,
  channelId,
  category,
  categories,
  services,
  servicesFiltered,
  options,
  optionsForService,
  channels,
  selectedCountryOpt,
  countryOptions,
  isJetski,
  discountEuros,
  maxManualDiscountCents,
  baseTotalCents,
  discountCentsRaw,
  euros,
  onSubmit,
  setFirstName,
  setLastName,
  setCustomerCountry,
  setServiceId,
  setOptionId,
  setQuantity,
  setPax,
  setChannelId,
  setCategory,
  setDiscountEuros,
}: Props) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Pre-reserva</h2>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Alta rápida para carpa con precio, descuento y canal.
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Nombre
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={fieldStyle} />
          </label>
          <label>
            Apellidos
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required style={fieldStyle} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div>País</div>
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
          Categoría
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
          Duración
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)} style={fieldStyle}>
            {optionsForService.map((option) => (
              <option key={option.id} value={option.id}>
                {option.durationMinutes} min · máx {option.paxMax} pax · {euros(option.basePriceCents)}
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
            value={discountEuros}
            onChange={(e) => setDiscountEuros(e.target.value)}
            placeholder="0"
            style={fieldStyle}
          />
        </label>

        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Máx descuento manual: <b>{euros(maxManualDiscountCents)}</b> (30% sobre {euros(baseTotalCents)})
          {discountCentsRaw > maxManualDiscountCents ? (
            <span style={{ marginLeft: 8, color: "#b91c1c" }}>limitado a {euros(maxManualDiscountCents)}</span>
          ) : null}
        </div>

        <label>
          Canal opcional
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} style={fieldStyle}>
            <option value="">(ninguno)</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" style={{ ...darkBtn, width: "100%" }}>
          Crear y generar código
        </button>
      </form>
    </section>
  );
}
