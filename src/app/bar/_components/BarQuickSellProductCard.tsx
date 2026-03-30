"use client";

import type React from "react";

import { styles } from "@/components/ui";
import { calculateBarLineTotal, getBarPromotionBadge } from "@/lib/bar-pricing";
import type { BarCategoryWithProducts, BarMethod } from "../services/bar";

type Product = BarCategoryWithProducts["products"][number];

type BarQuickSellProductCardProps = {
  product: Product;
  quantity: number;
  staffMode: boolean;
  actionBusy: string | null;
  onDecreaseQuantity: () => void;
  onSetQuantity: (value: number) => void;
  onIncreaseQuantity: () => void;
  onQuickSell: (method: BarMethod) => void;
  methodPill: (method: BarMethod) => React.CSSProperties;
};

export function BarQuickSellProductCard({
  product,
  quantity,
  staffMode,
  actionBusy,
  onDecreaseQuantity,
  onSetQuantity,
  onIncreaseQuantity,
  onQuickSell,
  methodPill,
}: BarQuickSellProductCardProps) {
  const stockValue = Number(product.currentStock ?? 0);
  const minStockValue = Number(product.minStock ?? 0);
  const lowStock = product.controlsStock && stockValue <= minStockValue;
  const unitPriceCents =
    staffMode && product.staffEligible && product.staffPriceCents != null
      ? Number(product.staffPriceCents)
      : Number(product.salePriceCents);
  const pricing = calculateBarLineTotal({
    unitPriceCents,
    quantity,
    promotions: product.promotions,
    staffMode,
    staffPriceCents: product.staffPriceCents,
  });
  const promoBadge = !staffMode && product.promotions?.length ? getBarPromotionBadge(product.promotions) : null;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 14,
        background: lowStock ? "#fff7ed" : "#f8fafc",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        {promoBadge ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...styles.pill, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontWeight: 900 }}>
              {promoBadge}
            </span>
          </div>
        ) : null}
        <div style={{ fontSize: 17, fontWeight: 900 }}>{product.name}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          {(unitPriceCents / 100).toFixed(2)} EUR - IVA {String(product.vatRate)}%
          {staffMode && product.staffEligible ? " - STAFF" : ""}
        </div>
        {!staffMode && pricing.appliedPromotion ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#166534" }}>{pricing.label}</div>
        ) : null}
        {product.controlsStock ? (
          <div style={{ fontSize: 12, color: lowStock ? "#c2410c" : "#475569", fontWeight: lowStock ? 800 : 500 }}>
            Stock: {String(product.currentStock)} {product.unitLabel ?? "ud"}
            {lowStock ? " - stock bajo" : ""}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#475569" }}>Sin control de stock</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Cantidad</div>
        <button type="button" onClick={onDecreaseQuantity} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}>
          -
        </button>
        <input
          value={String(quantity)}
          onChange={(e) => {
            const raw = Number(e.target.value);
            onSetQuantity(Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1);
          }}
          style={{ width: 70, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, textAlign: "center" }}
        />
        <button type="button" onClick={onIncreaseQuantity} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}>
          +
        </button>
        <div style={{ display: "grid", gap: 2 }}>
          {!staffMode && pricing.appliedPromotion ? (
            <div style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700 }}>
              Normal: {((unitPriceCents * quantity) / 100).toFixed(2)} EUR
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            Total: {(pricing.totalCents / 100).toFixed(2)} EUR
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["CASH", "CARD", "BIZUM", "TRANSFER"] as BarMethod[]).map((method) => {
          const busy = actionBusy === `${product.id}-${method}`;
          return (
            <button
              key={method}
              type="button"
              onClick={() => onQuickSell(method)}
              disabled={busy}
              style={{ padding: "10px 14px", borderRadius: 12, cursor: "pointer", ...methodPill(method) }}
            >
              {busy ? "Guardando..." : `${method} - ${(pricing.totalCents / 100).toFixed(2)} EUR`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
