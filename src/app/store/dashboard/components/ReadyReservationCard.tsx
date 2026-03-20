// src/app/store/dashboard/components/ReadyReservationCard.tsx
"use client";

import type React from "react";
import type { ExtraUiMap, PayLine, PayMethod, ReservationRow, Service } from "../types";
import { euros, hhmm, statusColor } from "../utils";
import { ReservationOpsPanel } from "./ReservationOpsPanel";

type ReadyReservationCardProps = {
  r: ReservationRow;
  isCashClosed: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  applyPlatformExtras: (reservationId: string) => Promise<void>;
  createPayment: (
    input: {
      reservationId: string;
      amountCents: number;
      method: PayMethod;
      origin: "STORE" | "BOOTH" | "BAR" | "WEB";
      isDeposit: boolean;
      direction?: "IN" | "OUT";
    },
    opts?: { reload?: boolean }
  ) => Promise<void>;
  load: () => Promise<void>;
  setError: (msg: string | null) => void;
  servicesExtra: Service[];
  extraUi: ExtraUiMap;
  setExtraUi: React.Dispatch<React.SetStateAction<ExtraUiMap>>;
  getExtraState: (reservationId: string, servicesExtra: Service[], extraUi: ExtraUiMap) => { extraServiceId: string; qty: number };
  addExtraToReservation: (reservationId: string) => Promise<void>;
  servicePayLines: PayLine[];
  addServicePayLine: () => void;
  removeServicePayLine: (idx: number) => void;
  updateServicePayLine: (idx: number, patch: Partial<PayLine>) => void;
  chargeServiceSplit: (reservationId: string, maxServiceCents: number) => Promise<void>;
  btnSecondary: React.CSSProperties;
  showReturnedBanner?: boolean;
  showReturnedActions?: boolean;
  completeReturn: (reservationId: string) => Promise<void>;
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

export function ReadyReservationCard(props: ReadyReservationCardProps) {
  const {
    r,
    isCashClosed,
    isOpen,
    onToggleOpen,
    method,
    setMethod,
    applyPlatformExtras,
    createPayment,
    load,
    setError,
    servicesExtra,
    extraUi,
    setExtraUi,
    getExtraState,
    addExtraToReservation,
    servicePayLines,
    addServicePayLine,
    removeServicePayLine,
    updateServicePayLine,
    chargeServiceSplit,
    btnSecondary,
    showReturnedBanner = false,
    showReturnedActions = false,
    completeReturn,
  } = props;

  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const deposit = Number(r.depositCents ?? 0);
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const pendingTotal = pendingService + pendingDeposit;
  const hasDepositIn = (r.payments ?? []).some((p) => p.isDeposit && p.direction !== "OUT");
  const hasDepositOut = (r.payments ?? []).some((p) => p.isDeposit && p.direction === "OUT");
  const depositHeld = r.depositHeld === true;
  const depositStatus = depositHeld
    ? "RETENIDA"
    : paidDepositCents <= 0
      ? hasDepositIn && hasDepositOut
        ? "DEVUELTA"
        : "PENDIENTE"
      : "LIBERABLE";
  const paid = Number(r.paidCents ?? 0);
  const isFullyPaid = pendingTotal === 0;

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong>{r.customerName || "Sin nombre"}</strong>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{hhmm(r.scheduledTime) || "sin hora"}</span>
          <Badge label={r.status} color={statusColor(r.status)} />
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 900, background: "#fff", cursor: "pointer" }}
        >
          {isOpen ? "Cerrar" : "Abrir"}
        </button>
      </div>

        {showReturnedBanner && r.arrivalAt ? (
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Devuelta ·{" "}
            {new Date(r.arrivalAt).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        ) : null}

      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
        {r.serviceName ?? "Servicio"}
        {r.durationMinutes ? ` · ${r.durationMinutes} min` : ""}
      </div>

      {r.platformExtrasPendingCount ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <Badge label={`Extras plataforma: ${r.platformExtrasPendingCount}`} color="#93c5fd" />
          <button type="button" onClick={() => applyPlatformExtras(r.id)} style={btnSecondary}>
            Aplicar extras
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Badge label={`Fianza ${euros(Math.min(paidDepositCents, deposit))}`} color="#fef9c3" />
        <Badge
          label={
            depositStatus === "PENDIENTE"
              ? "Fianza pendiente"
              : depositStatus === "LIBERABLE"
                ? "Fianza liberable"
                : depositStatus === "DEVUELTA"
                  ? "Fianza devuelta"
                  : "Fianza retenida"
          }
          color={
            depositStatus === "PENDIENTE"
              ? "#fee2e2"
              : depositStatus === "LIBERABLE"
                ? "#fef9c3"
                : depositStatus === "DEVUELTA"
                  ? "#dcfce7"
                  : "#e5e7eb"
          }
        />
        {pendingTotal > 0 ? <Badge label={`Pendiente ${euros(pendingTotal)}`} color="#fee2e2" /> : <Badge label="Todo cobrado" color="#dcfce7" />}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Cobrado</div>
            <div style={{ fontWeight: 800 }}>{euros(paid)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Pendiente</div>
            <div style={{ fontWeight: 800 }}>{euros(pendingTotal)}</div>
          </div>
          {isFullyPaid ? <div style={{ fontWeight: 800 }}>✅ Pagado</div> : null}
        </div>
      </div>

        {r.depositHeld ? (
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
            <div style={{ fontWeight: 800 }}>⚠ Incidencia con fianza retenida</div>
            <div>{r.depositHoldReason || "Retenida por incidencia registrada desde plataforma."}</div>
          </div>
        ) : null}

        {showReturnedActions && r.status === "WAITING" && r.arrivalAt ? (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px dashed #ddd",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => completeReturn(r.id)}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cerrar devolución
            </button>
          </div>
        ) : null}

      {isOpen ? (
        <div style={{ marginTop: 12 }}>
          <ReservationOpsPanel
            r={r}
            isCashClosed={isCashClosed}
            method={method}
            setMethod={setMethod}
            createPayment={createPayment}
            reloadDashboard={load}
            setError={setError}
            servicesExtra={servicesExtra}
            extraUi={extraUi}
            setExtraUi={setExtraUi}
            getExtraState={getExtraState}
            addExtraToReservation={addExtraToReservation}
            servicePayLines={servicePayLines}
            addServicePayLine={addServicePayLine}
            removeServicePayLine={removeServicePayLine}
            updateServicePayLine={updateServicePayLine}
            chargeServiceSplit={chargeServiceSplit}
          />
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, opacity: 0.85 }}>
        <span>Cant: {r.quantity}</span>
        <span>PAX: {r.pax}</span>
        <span>{r.isLicense ? "Licencia" : "Sin licencia"}</span>
        <span>Canal: {r.channelName ?? "-"}</span>
      </div>
    </div>
  );
}
