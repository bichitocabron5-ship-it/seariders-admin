"use client";

import type React from "react";

import type { ReservationRow } from "../types";
import { euros, hhmm, statusColor } from "../utils";

type ContractsState = "OK" | "PARTIAL" | "MISSING" | null;
type DepositStatus = "RETENIDA" | "PENDIENTE" | "LIBERABLE" | "DEVUELTA";

type StoreReservationCardSummaryProps = {
  reservation: ReservationRow;
  btnSecondary: React.CSSProperties;
  finalTotal: number;
  pvpTotal: number;
  autoDisc: number;
  manualDisc: number;
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: color,
        color: "#111",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function contractTone(contractsState: ContractsState) {
  if (contractsState === "OK") {
    return { border: "#bbf7d0", background: "#ecfdf5", color: "#065f46" };
  }
  if (contractsState === "PARTIAL") {
    return { border: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  return { border: "#fecaca", background: "#fff1f2", color: "#991b1b" };
}

function depositLabel(depositStatus: DepositStatus) {
  if (depositStatus === "PENDIENTE") return "Fianza pendiente";
  if (depositStatus === "LIBERABLE") return "Fianza liberable";
  if (depositStatus === "DEVUELTA") return "Fianza devuelta";
  return "Fianza retenida";
}

function depositColor(depositStatus: DepositStatus) {
  if (depositStatus === "PENDIENTE") return "#fee2e2";
  if (depositStatus === "LIBERABLE") return "#fef9c3";
  if (depositStatus === "DEVUELTA") return "#dcfce7";
  return "#fecaca";
}

function flowStageLabel(reservation: ReservationRow) {
  if (reservation.storeFlowStage === "RETURN_PENDING_CLOSE") return "Devuelta";
  if (reservation.storeFlowStage === "QUEUE") return "Pendiente";
  return reservation.status;
}

function flowStageColor(reservation: ReservationRow) {
  if (reservation.storeFlowStage === "RETURN_PENDING_CLOSE") return "#fde68a";
  if (reservation.storeFlowStage === "QUEUE") return "#e5e7eb";
  return statusColor(reservation.status);
}

export function StoreReservationCardSummary({
  reservation,
  btnSecondary,
  finalTotal,
  pvpTotal,
  autoDisc,
  manualDisc,
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
  const contractsTone = contractTone(contractsState);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong>{reservation.customerName || "Sin nombre"}</strong>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{timeLabel}</span>
          <Badge label={flowStageLabel(reservation)} color={flowStageColor(reservation)} />

          {showContracts ? (
            <div
              title={`Contratos listos: ${readyCount}/${requiredUnits}`}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${contractsTone.border}`,
                background: contractsTone.background,
                color: contractsTone.color,
                fontWeight: 900,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Contratos {readyCount}/{requiredUnits}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onEdit} style={btnSecondary}>
            Reagendar
          </button>
          <button
            type="button"
            onClick={() => void onCancel()}
            style={{ ...btnSecondary, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b" }}
          >
            Cancelar
          </button>
          {needsContracts ? (
            <button type="button" onClick={onCompleteContracts} style={btnSecondary}>
              Completar contratos
            </button>
          ) : null}
          {isFullyPaid ? (
            <button
              type="button"
              onClick={() => void onPassToReady()}
              disabled={needsContracts}
              title={needsContracts ? "Faltan contratos por completar" : ""}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                opacity: needsContracts ? 0.6 : 1,
                cursor: needsContracts ? "not-allowed" : "pointer",
              }}
            >
              Pasar a Ready
            </button>
          ) : null}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900 }}>{euros(finalTotal)}</div>
          {autoDisc > 0 || manualDisc > 0 ? (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{euros(pvpTotal)}</span>
              {autoDisc > 0 ? <span style={{ marginLeft: 8 }}>Auto: -{euros(autoDisc)}</span> : null}
              {manualDisc > 0 ? <span style={{ marginLeft: 8 }}>Manual: -{euros(manualDisc)}</span> : null}
              {reservation.manualDiscountReason ? <div style={{ marginTop: 2, opacity: 0.75 }}>Motivo: {reservation.manualDiscountReason}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
        {reservation.serviceName ? reservation.serviceName : "Servicio"}
        {reservation.durationMinutes ? ` · ${reservation.durationMinutes} min` : ""}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <Badge label={`Servicio ${euros(servicePaid)}`} color="#e0f2fe" />
        <Badge label={`Fianza ${euros(depositPaid)}`} color="#fef9c3" />
        <Badge label={depositLabel(depositStatus)} color={depositColor(depositStatus)} />
        {pendingCents > 0 ? <Badge label={`Pendiente ${euros(pendingCents)}`} color="#fee2e2" /> : <Badge label="Todo cobrado" color="#dcfce7" />}
        {waitMeta ? <Badge label={waitMeta.label} color={waitMeta.bg} /> : null}
      </div>

      <div style={{ opacity: 0.85, marginTop: 6 }}>
        <div>Total (final): {euros(finalTotal)}</div>
        <div style={{ opacity: 0.8 }}>PVP: {euros(pvpTotal)}</div>
        <div>Servicio: {euros(serviceTotal)}</div>
        <div>Extras: {euros(extrasTotal)}</div>
        <div>Fianza: {euros(deposit)}</div>
        <div>
          <strong>Total a cobrar hoy:</strong> {euros(totalToChargeCents)}
        </div>
      </div>

      {reservation.depositHeld ? (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            display: "grid",
            gap: 4,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 800 }}>Incidencia registrada</div>
          <div>{reservation.depositHoldReason || "Fianza retenida por incidencia de plataforma."}</div>
        </div>
      ) : null}
    </>
  );
}
