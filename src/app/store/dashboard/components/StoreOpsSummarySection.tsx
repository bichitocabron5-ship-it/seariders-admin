"use client";

import type React from "react";

import { SectionCard, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";
import { StoreMetricCard, StoreMetricGrid } from "@/components/store-ui";

import type { CashClosureSummary, CashSummary, CommissionSummary } from "../types";
import { euros } from "../utils";

type StoreOpsSummarySectionProps = {
  cashSummary: CashSummary | null;
  commissionSummary: CommissionSummary | null;
  cashClosureSummary: CashClosureSummary | null;
  returnedWithIncidentCount: number;
  rowsRightCount: number;
  platformExtrasPendingCount: number;
};

const panelCard: React.CSSProperties = {
  padding: 10,
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 16,
  background: brand.colors.surface,
  display: "grid",
  gap: 12,
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};

export function StoreOpsSummarySection({
  cashSummary,
  commissionSummary,
  cashClosureSummary,
  returnedWithIncidentCount,
  rowsRightCount,
  platformExtrasPendingCount,
}: StoreOpsSummarySectionProps) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
      {cashSummary ? (
        <SectionCard eyebrow="Store" title="Caja de hoy">
          <StoreMetricGrid>
            <StoreMetricCard label="Cobrado total" value={euros(cashSummary.totalCents)} />
            <StoreMetricCard label="Servicio" value={euros(cashSummary.serviceCents)} />
            <StoreMetricCard label="Fianzas" value={euros(cashSummary.depositCents)} />
            <StoreMetricCard label="Pagos" value={cashSummary.count} />
          </StoreMetricGrid>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <div style={smallLabel}>Por método</div>
              {Object.entries(cashSummary.byMethod).map(([key, value]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>{key}</div>
                  <div>{euros(value.netCents)}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={smallLabel}>Por origen</div>
              {Object.entries(cashSummary.byOrigin).map(([key, value]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>{key}</div>
                  <div>{euros(value.netCents)}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="Store"
        title="Comisiones"
        action={<StatusBadge tone={commissionSummary ? "success" : "neutral"}>{commissionSummary ? "Cargado" : "Sin datos"}</StatusBadge>}
      >
        {commissionSummary ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Total comisiones: <strong>{euros(commissionSummary.totalCommissionCents)}</strong>
            </div>
            {Object.entries(commissionSummary.byOrigin).map(([origin, originSummary]) => (
              <div
                key={origin}
                style={{
                  ...panelCard,
                  padding: 10,
                  background: brand.colors.surfaceSoft,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{origin}</strong>
                  <strong>{euros(originSummary.totalCommissionCents)}</strong>
                </div>
                {Object.entries(originSummary.byChannel).map(([channel, cents]) => (
                  <div key={`${origin}:${channel}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span>{channel}</span>
                    <strong>{euros(Number(cents))}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.6 }}>No hay datos de comisión o falló la carga.</div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Store"
        title="Estado operativo"
        action={
          <StatusBadge tone={cashClosureSummary?.isClosed ? "warning" : "success"}>
            {cashClosureSummary?.isClosed ? "Caja cerrada" : "Caja abierta"}
          </StatusBadge>
        }
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={smallLabel}>Cierre de caja</span>
            <strong>{cashClosureSummary?.isClosed ? "Cerrado" : "Abierto"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={smallLabel}>Devueltas con incidencia</span>
            <strong>{returnedWithIncidentCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={smallLabel}>Ready / En mar</span>
            <strong>{rowsRightCount}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={smallLabel}>Extras de plataforma</span>
            <strong>{platformExtrasPendingCount}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {cashClosureSummary?.isClosed
              ? `Último cierre: ${cashClosureSummary.closure?.closedAt ? new Date(cashClosureSummary.closure.closedAt).toLocaleString() : "sin fecha"}`
              : "Pendiente de cierre en este turno."}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
