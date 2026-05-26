"use client";

import type React from "react";

import { opsStyles } from "@/components/ops-ui";
import { StoreMetricCard, StoreMetricGrid } from "@/components/store-ui";

import type { CustomerSearchRow } from "../types";

type SummaryCard = {
  label: string;
  value: React.ReactNode;
};

type StoreCreateSummaryStripProps = {
  cards: SummaryCard[];
};

type StoreCreateCustomerProfileSectionProps = {
  customerSearch: string;
  customerMatches: CustomerSearchRow[];
  customerSearchBusy: boolean;
  customerSearchError: string | null;
  appliedCustomerProfileName: string | null;
  onCustomerSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onApplyCustomerProfile: (reservationId: string) => void;
};

const customerPanelStyle: React.CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  padding: 16,
  display: "grid",
  gap: 12,
};

function formatShortDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-ES");
}

function shortReservationId(value: string) {
  const clean = String(value ?? "").trim();
  if (clean.length <= 8) return clean || "—";
  return clean.slice(0, 8).toUpperCase();
}

export function StoreCreateSummaryStrip({ cards }: StoreCreateSummaryStripProps) {
  return (
    <StoreMetricGrid>
      {cards.map((card) => (
        <StoreMetricCard key={card.label} label={card.label} value={card.value} />
      ))}
    </StoreMetricGrid>
  );
}

export function StoreCreateCustomerProfileSection({
  customerSearch,
  customerMatches,
  customerSearchBusy,
  customerSearchError,
  appliedCustomerProfileName,
  onCustomerSearchChange,
  onSearchSubmit,
  onApplyCustomerProfile,
}: StoreCreateCustomerProfileSectionProps) {
  return (
    <>
      <div style={customerPanelStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Cliente repetidor / recuperar ficha</div>
          <div style={{ fontSize: 13, color: "#64748b", maxWidth: 760 }}>
            Busca por nombre o documento y reutiliza los datos del cliente para acelerar la reserva sin reescribir la
            ficha.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, alignItems: "center" }}>
          <input
            value={customerSearch}
            onChange={(e) => onCustomerSearchChange(e.target.value)}
            placeholder="Buscar por nombre o documento"
            style={{
              ...opsStyles.field,
              padding: 10,
              borderRadius: 10,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
          />
          <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
            {customerSearch.trim().length >= 2 ? "La búsqueda se actualiza automáticamente." : "Escribe al menos 2 caracteres."}
          </div>
        </div>

        {customerSearchBusy ? <div style={{ fontSize: 12, opacity: 0.7 }}>Buscando coincidencias...</div> : null}

        {customerSearch.trim().length >= 2 && !customerSearchBusy && customerMatches.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No se encontraron clientes previos.</div>
        ) : null}

        {customerSearchError ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
            }}
          >
            {customerSearchError}
          </div>
        ) : null}

        {customerMatches.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {customerMatches.map((customer) => (
              <div
                key={customer.reservationId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(160px, 220px)",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>
                      {customer.customerName?.trim() || customer.customerDocNumber?.trim() || customer.phone?.trim() || customer.email?.trim() || "Cliente previo"}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        color: "#0f766e",
                        background: "#ecfeff",
                        border: "1px solid #a5f3fc",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      Res. {shortReservationId(customer.reservationId)}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.78 }}>
                    {customer.customerDocNumber || "Sin documento"} · {customer.phone || "Sin teléfono"} · {customer.email || "Sin email"}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, opacity: 0.72 }}>
                    <span>Nacimiento: {formatShortDate(customer.birthDate)}</span>
                    <span>País: {customer.country || "—"}</span>
                    <span>CP: {customer.postalCode || "—"}</span>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    Última reserva: {formatShortDate(customer.lastActivityAt)}
                    {customer.serviceName ? ` · ${customer.serviceName}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyCustomerProfile(customer.reservationId)}
                  style={{
                    ...opsStyles.ghostButton,
                    padding: "8px 12px",
                    borderRadius: 10,
                    justifySelf: "stretch",
                  }}
                >
                  Usar ficha
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {appliedCustomerProfileName ? (
        <div style={{ fontSize: 12, color: "#166534", fontWeight: 800 }}>
          Ficha recuperada de cliente previo: {appliedCustomerProfileName}
        </div>
      ) : null}
    </>
  );
}
