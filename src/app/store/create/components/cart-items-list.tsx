"use client";

import type React from "react";

import { opsStyles } from "@/components/ops-ui";

import type { CartItem, Option, ServiceMain } from "../types";

type CartItemsListProps = {
  cartItems: CartItem[];
  servicesMain: ServiceMain[];
  options: Option[];
  getMaxAllowed: (item: CartItem) => number;
  getAvailabilityLabel: (item: CartItem) => string | null;
  isAssetLimited: (item: CartItem) => boolean;
  onRemoveFromCart: (id: string) => void;
  onUpdateCartItem: (id: string, patch: Partial<Pick<CartItem, "quantity" | "pax">>) => void;
  onError: (message: string | null) => void;
};

const secondaryButtonStyle: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
};

const inputStyle: React.CSSProperties = opsStyles.field;

export function CartItemsList({
  cartItems,
  servicesMain,
  options,
  getMaxAllowed,
  getAvailabilityLabel,
  isAssetLimited,
  onRemoveFromCart,
  onUpdateCartItem,
  onError,
}: CartItemsListProps) {
  const hasSoldOutLimitedItems = cartItems.some((item) => {
    const maxAllowed = getMaxAllowed(item);
    return isAssetLimited(item) && Number.isFinite(maxAllowed) && maxAllowed <= 0;
  });

  if (cartItems.length === 0) {
    return <div style={{ fontSize: 13, color: "#64748b" }}>No hay ítems. Si no añades nada, se creará solo con el servicio seleccionado arriba.</div>;
  }

  return (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        {cartItems.map((item) => {
          const service = servicesMain.find((candidate) => candidate.id === item.serviceId);
          const option = options.find((candidate) => candidate.id === item.optionId);

          const availabilityLabel = getAvailabilityLabel(item);
          const maxAllowed = getMaxAllowed(item);
          const limited = isAssetLimited(item);
          const quantity = Number(item.quantity ?? 1);
          const soldOut = limited && Number.isFinite(maxAllowed) && maxAllowed <= 0;
          const atMax = limited && Number.isFinite(maxAllowed) && quantity >= maxAllowed;

          return (
            <article
              key={item.id}
              style={{
                padding: 14,
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                display: "grid",
                gap: 10,
                background: soldOut ? "#fff7ed" : "#fdfefe",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, alignItems: "center" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>
                    {service?.category ? `${service.category} | ` : ""}
                    {service?.name ?? item.serviceId}
                    {option?.durationMinutes ? ` | ${option.durationMinutes} min` : ""}
                  </div>

                  {availabilityLabel ? (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: soldOut ? "#991b1b" : atMax ? "#c2410c" : "#475569",
                      }}
                    >
                      {availabilityLabel}
                      {soldOut ? " · COMPLETO" : atMax ? " · máximo alcanzado" : ""}
                    </div>
                  ) : null}
                </div>

                <button type="button" onClick={() => onRemoveFromCart(item.id)} style={{ ...secondaryButtonStyle, width: "100%" }}>
                  Quitar
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                  Cantidad

                  <div style={{ display: "grid", gridTemplateColumns: "34px minmax(84px, 110px) 34px", gap: 8, alignItems: "center", width: "fit-content" }}>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCartItem(item.id, {
                          quantity: Math.max(1, quantity - 1),
                        })
                      }
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const raw = Number(e.target.value || 1);
                        const safe = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
                        const next = limited && Number.isFinite(maxAllowed) ? Math.min(safe, Math.max(0, maxAllowed)) : safe;

                        if (limited && Number.isFinite(maxAllowed) && safe > maxAllowed) {
                          onError(maxAllowed <= 0 ? "No hay unidades disponibles para este extra." : `Máximo disponible: ${maxAllowed}.`);
                        } else {
                          onError(null);
                        }

                        onUpdateCartItem(item.id, {
                          quantity: Math.max(1, next || 1),
                        });
                      }}
                      style={{
                        ...inputStyle,
                        width: 90,
                        textAlign: "center",
                        border: soldOut ? "1px solid #fca5a5" : inputStyle.border,
                        background: soldOut ? "#fff1f2" : "#fff",
                      }}
                    />

                    <button
                      type="button"
                      disabled={Boolean(atMax || soldOut)}
                      onClick={() => {
                        if (limited && Number.isFinite(maxAllowed) && quantity >= maxAllowed) {
                          onError(maxAllowed <= 0 ? "No hay unidades disponibles para este extra." : `Máximo disponible: ${maxAllowed}.`);
                          return;
                        }

                        onError(null);
                        onUpdateCartItem(item.id, {
                          quantity: quantity + 1,
                        });
                      }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: atMax || soldOut ? "#f8fafc" : "#fff",
                        color: atMax || soldOut ? "#94a3b8" : "#0f172a",
                        fontWeight: 900,
                        cursor: atMax || soldOut ? "not-allowed" : "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                  PAX para este ítem
                  <input
                    type="number"
                    min={1}
                    value={item.pax}
                    onChange={(e) =>
                      onUpdateCartItem(item.id, {
                        pax: Math.max(1, Number(e.target.value || 1)),
                      })
                    }
                    style={inputStyle}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>

      {hasSoldOutLimitedItems ? (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Hay extras reutilizables sin disponibilidad real. Revisa cantidades o elimina esos ítems.
        </div>
      ) : null}
    </>
  );
}
