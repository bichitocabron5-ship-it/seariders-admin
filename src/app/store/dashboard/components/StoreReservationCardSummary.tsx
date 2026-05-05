"use client";

import type React from "react";

import { ActionButton, AlertBanner, StatusBadge } from "@/components/seariders-ui";
import type { ReservationRow } from "../types";
import { euros, hhmm, statusColor } from "../utils";

type ContractsState = "OK" | "PARTIAL" | "MISSING" | null;
type DepositStatus = "NO_APLICA" | "RETENIDA" | "PENDIENTE" | "LIBERABLE" | "DEVUELTA";

type StoreReservationCardSummaryProps = {
  reservation: ReservationRow;
  finalTotal: number;
  pvpTotal: number;
  autoDisc: number;
  manualDisc: number;
  promoterDisc: number;
  companyDisc: number;
  servicePaid: number;
  depositPaid: number;
  pendingCents: number;
  depositStatus: DepositStatus;
  waitMeta: { label: string; bg: string } | null;
  serviceTotal: number;
  extrasTotal: number;
  deposit: number;
  totalToChargeCents: number;
  showContracts: boolean;
  requiredUnits: number;
  readyCount: number;
  needsContracts: boolean;
  contractsState: ContractsState;
  isFullyPaid: boolean;
  onEdit: () => void;
  onCancel: () => Promise<void>;
  onCompleteContracts: () => void;
  onPassToReady: () => Promise<void>;
};

function toneFromContracts(contractsState: ContractsState) {
  if (contractsState === "OK") return "success";
  if (contractsState === "PARTIAL") return "warning";
  return "danger";
}

function precheckinTone(readyCount: number, requiredUnits: number) {
  if (requiredUnits <= 0) return null;
  if (readyCount >= requiredUnits) {
    return { tone: "success" as const, label: "Pre-checkin completo" };
  }
  if (readyCount > 0) {
    return { tone: "warning" as const, label: "Pre-checkin en curso" };
  }
  return { tone: "danger" as const, label: "Pendiente de firma" };
}

function depositLabel(depositStatus: DepositStatus) {
  if (depositStatus === "NO_APLICA") return "Sin fianza";
  if (depositStatus === "PENDIENTE") return "Fianza pendiente";
  if (depositStatus === "LIBERABLE") return "Fianza liberable";
  if (depositStatus === "DEVUELTA") return "Fianza devuelta";
  return "Fianza retenida";
}

function depositTone(depositStatus: DepositStatus) {
  if (depositStatus === "NO_APLICA") return "neutral" as const;
  if (depositStatus === "PENDIENTE") return "danger" as const;
  if (depositStatus === "LIBERABLE") return "warning" as const;
  if (depositStatus === "DEVUELTA") return "success" as const;
  return "danger" as const;
}

function flowStageLabel(reservation: ReservationRow) {
  if (reservation.storeFlowStage === "RETURN_PENDING_CLOSE") return "Devuelta";
  if (reservation.storeFlowStage === "QUEUE") return "Pendiente";
  return reservation.status;
}

function flowStageTone(reservation: ReservationRow) {
  if (reservation.storeFlowStage === "RETURN_PENDING_CLOSE") return "warning" as const;
  if (reservation.storeFlowStage === "QUEUE") return "neutral" as const;
  const color = statusColor(reservation.status);
  if (color === "#dcfce7") return "success" as const;
  if (color === "#fee2e2") return "danger" as const;
  if (color === "#ffedd5") return "warning" as const;
  if (color === "#e5e7eb") return "neutral" as const;
  return "info" as const;
}

function waitTone(bg: string) {
  if (bg === "#dcfce7") return "success" as const;
  if (bg === "#fee2e2" || bg === "#fff1f2") return "danger" as const;
  if (bg === "#fef3c7" || bg === "#fde68a") return "warning" as const;
  return "info" as const;
}

export function StoreReservationCardSummary({
  reservation,
  finalTotal,
  pvpTotal,
  autoDisc,
  manualDisc,
  promoterDisc,
  companyDisc,
  servicePaid,
  depositPaid,
  pendingCents,
  depositStatus,
  waitMeta,
  serviceTotal,
  extrasTotal,
  deposit,
  totalToChargeCents,
  showContracts,
  requiredUnits,
  readyCount,
  needsContracts,
  contractsState,
  isFullyPaid,
  onEdit,
  onCancel,
  onCompleteContracts,
  onPassToReady,
}: StoreReservationCardSummaryProps) {
  const timeLabel = hhmm(reservation.scheduledTime) || "sin hora";
  const precheckin = precheckinTone(readyCount, requiredUnits);
  const showDeposit = depositStatus !== "NO_APLICA";
  const totalDiscount = autoDisc + manualDisc;
  const jetskiAssignments = reservation.jetskiAssignments ?? [];

  return (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong>{reservation.customerName || "Sin nombre"}</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{timeLabel}</span>
            <StatusBadge tone={flowStageTone(reservation)}>{flowStageLabel(reservation)}</StatusBadge>

            {showContracts ? (
              <>
                <StatusBadge tone={toneFromContracts(contractsState)}>
                  Contratos {readyCount}/{requiredUnits}
                </StatusBadge>
                {precheckin ? <StatusBadge tone={precheckin.tone}>{precheckin.label}</StatusBadge> : null}
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton type="button" onClick={onEdit} variant="secondary">
              Reagendar
            </ActionButton>
            <ActionButton
              type="button"
              onClick={() => void onCancel()}
              variant="danger"
            >
              Cancelar
            </ActionButton>
            {needsContracts ? (
              <ActionButton type="button" onClick={onCompleteContracts} variant="secondary">
                Completar contratos
              </ActionButton>
            ) : null}
            {isFullyPaid ? (
              <ActionButton
                type="button"
                onClick={() => void onPassToReady()}
                disabled={needsContracts}
                title={needsContracts ? "Faltan contratos por completar" : ""}
                variant="primary"
                style={{ opacity: needsContracts ? 0.6 : 1, cursor: needsContracts ? "not-allowed" : "pointer" }}
              >
                Pasar a Ready
              </ActionButton>
            ) : null}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900 }}>{euros(finalTotal)}</div>
            {totalDiscount > 0 ? (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{euros(pvpTotal)}</span>
                {autoDisc > 0 ? <span style={{ marginLeft: 8 }}>Auto: -{euros(autoDisc)}</span> : null}
                {manualDisc > 0 ? <span style={{ marginLeft: 8 }}>Manual: -{euros(manualDisc)}</span> : null}
                {promoterDisc > 0 ? <span style={{ marginLeft: 8 }}>Promotor: {euros(promoterDisc)}</span> : null}
                {companyDisc > 0 ? <span style={{ marginLeft: 8 }}>Empresa: {euros(companyDisc)}</span> : null}
                {reservation.manualDiscountReason ? <div style={{ marginTop: 2, opacity: 0.75 }}>Motivo: {reservation.manualDiscountReason}</div> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {reservation.serviceName ? reservation.serviceName : "Servicio"}
          {reservation.durationMinutes ? ` · ${reservation.durationMinutes} min` : ""}
        </div>
      </div>

      {jetskiAssignments.length > 0 ? (
        <div style={{ fontSize: 13, color: "#0f172a", marginTop: 6 }}>
          Motos:{" "}
          {jetskiAssignments
            .map((assignment) =>
              `Moto ${assignment.jetskiNumber ?? "?"}${assignment.unitIndex ? ` U${assignment.unitIndex}` : ""}`
            )
            .join(" · ")}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <StatusBadge tone="info">Servicio {euros(servicePaid)}</StatusBadge>
        {showDeposit ? <StatusBadge tone="warning">Fianza {euros(depositPaid)}</StatusBadge> : null}
        {showDeposit ? <StatusBadge tone={depositTone(depositStatus)}>{depositLabel(depositStatus)}</StatusBadge> : null}
        {pendingCents > 0 ? <StatusBadge tone="danger">Pendiente {euros(pendingCents)}</StatusBadge> : <StatusBadge tone="success">Todo cobrado</StatusBadge>}
        {waitMeta ? <StatusBadge tone={waitTone(waitMeta.bg)}>{waitMeta.label}</StatusBadge> : null}
      </div>

      <div style={{ opacity: 0.85, marginTop: 6 }}>
        <div>PVP original: {euros(pvpTotal)}</div>
        <div>Descuento aplicado: -{euros(totalDiscount)}</div>
        <div>Total final: {euros(finalTotal)}</div>
        <div>Servicio: {euros(serviceTotal)}</div>
        <div>Extras: {euros(extrasTotal)}</div>
        {showDeposit ? <div>Fianza: {euros(deposit)}</div> : null}
        <div>
          <strong>Pendiente real a cobrar:</strong> {euros(pendingCents)}
        </div>
        <div>
          <strong>Total a cobrar hoy:</strong> {euros(totalToChargeCents)}
        </div>
        {reservation.commissionBaseCents != null ? <div style={{ opacity: 0.8 }}>Base comisionable: {euros(reservation.commissionBaseCents)}</div> : null}
      </div>

      {reservation.depositHeld ? (
        <div style={{ marginTop: 8 }}>
          <AlertBanner tone="danger" title="Incidencia registrada">
            {reservation.depositHoldReason || "Fianza retenida por incidencia de plataforma."}
          </AlertBanner>
        </div>
      ) : null}
    </>
  );
}
