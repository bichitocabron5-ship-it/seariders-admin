"use client";

import type React from "react";

import {
  type CommercialSummarySnapshot,
  getCommercialSummaryTotalDiscountCents,
  hasCommercialSummaryAdjustments,
} from "../shared/commercial-summary";

type StoreCommercialSummaryBlockProps = {
  summary: CommercialSummarySnapshot;
  heading?: string;
  pendingLabel?: string;
  variant?: "panel" | "plain";
};

const basePanelStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #dbe4ee",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 10,
};

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

export function StoreCommercialSummaryBlock({
  summary,
  heading,
  pendingLabel = "Pendiente a cobrar",
  variant = "plain",
}: StoreCommercialSummaryBlockProps) {
  const totalDiscountCents = getCommercialSummaryTotalDiscountCents(summary);
  const hasAdjustments = hasCommercialSummaryAdjustments(summary);
  const containerStyle = variant === "panel" ? basePanelStyle : ({ display: "grid", gap: 6 } satisfies React.CSSProperties);

  return (
    <section style={containerStyle}>
      {heading ? (
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: "#64748b" }}>
            Resumen comercial
          </div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>{heading}</div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 4, color: "#334155", fontSize: 13 }}>
        <div>PVP original: {euros(summary.pvpOriginalCents)}</div>
        {totalDiscountCents > 0 ? (
          <>
            <div>Descuento aplicado: -{euros(totalDiscountCents)}</div>
            {summary.customerDiscountCents > 0 ? <div>Canal/cliente: -{euros(summary.customerDiscountCents)}</div> : null}
            {summary.autoDiscountCents > 0 ? <div>Promo/auto: -{euros(summary.autoDiscountCents)}</div> : null}
            {summary.manualDiscountCents > 0 ? <div>Manual: -{euros(summary.manualDiscountCents)}</div> : null}
          </>
        ) : (
          <div>Descuento aplicado: -{euros(0)}</div>
        )}
        <div>
          <strong>Total final:</strong> {euros(summary.finalTotalCents)}
        </div>
        {hasAdjustments ? (
          <>
            {summary.commissionBaseCents > 0 ? <div>Base comisionable: {euros(summary.commissionBaseCents)}</div> : null}
            {summary.appliedCommissionCents > 0 ? (
              <div>
                Comision canal:{" "}
                {summary.appliedCommissionMode === "FIXED"
                  ? `${Number(summary.appliedCommissionValue ?? 0).toFixed(2)} EUR`
                  : `${Number(summary.appliedCommissionPct ?? summary.appliedCommissionValue ?? 0).toFixed(2)}%`}{" "}
                - {euros(summary.appliedCommissionCents)}
              </div>
            ) : null}
            {summary.promoterDiscountCents > 0 || summary.companyDiscountCents > 0 ? (
              <div>
                Reparto descuento - promotor {euros(summary.promoterDiscountCents)} - empresa {euros(summary.companyDiscountCents)}
              </div>
            ) : null}
          </>
        ) : null}
        <div>
          <strong>{pendingLabel}:</strong> {euros(summary.pendingToChargeCents)}
        </div>
      </div>
    </section>
  );
}
