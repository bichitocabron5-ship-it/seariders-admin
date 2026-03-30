"use client";

import type React from "react";

import { StoreMetricCard, StoreMetricGrid, StoreSectionHeader } from "@/components/store-ui";

type ContractsHeaderSummaryProps = {
  readyCount: number;
  requiredUnits: number;
  signedCount: number;
  pendingCount: number;
  stateTone: {
    label: string;
    color: string;
    bg: string;
    border: string;
  };
  sectionEyebrowStyle: React.CSSProperties;
  refreshButtonStyle: React.CSSProperties;
  onRefresh: () => void;
};

export function ContractsHeaderSummary({
  readyCount,
  requiredUnits,
  signedCount,
  pendingCount,
  stateTone,
  sectionEyebrowStyle,
  refreshButtonStyle,
  onRefresh,
}: ContractsHeaderSummaryProps) {
  return (
    <>
      <StoreSectionHeader
        eyebrow="Documentación"
        eyebrowColor="#7c3aed"
        title="Contratos"
        description="Preparación contractual, vista previa y soporte para firma digital."
        action={
          <button type="button" onClick={onRefresh} style={refreshButtonStyle}>
            Refrescar
          </button>
        }
      />

      <StoreMetricGrid>
        <StoreMetricCard label="Operativo" value={`${readyCount}/${requiredUnits}`} description="Contratos listos o firmados." accentColor={sectionEyebrowStyle.color as string} />

        <StoreMetricCard
          label="Estado global"
          value={
            <span
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${stateTone.border}`,
                background: stateTone.bg,
                color: stateTone.color,
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              {stateTone.label}
            </span>
          }
          description="El cobro sigue bloqueado hasta completar los requeridos."
          accentColor={sectionEyebrowStyle.color as string}
        />

        <StoreMetricCard label="Firma digital" value="Preparación activa" description="Genera vista previa y PDF desde cada unidad antes de firmar." accentColor={sectionEyebrowStyle.color as string} />

        <StoreMetricCard
          label="Seguimiento"
          value={`${signedCount} firmados · ${pendingCount} pendientes`}
          description="Referencia rápida para saber si la reserva ya está lista para cerrar."
          accentColor={sectionEyebrowStyle.color as string}
        />
      </StoreMetricGrid>
    </>
  );
}
