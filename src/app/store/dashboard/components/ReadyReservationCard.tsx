"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

import { ActionButton, AlertBanner, StatusBadge } from "@/components/seariders-ui";
import type {
  CompleteReturnInput,
  ExtraUiMap,
  PayLine,
  PayMethod,
  ReservationRow,
  ReturnSettlementMode,
  Service,
} from "../types";
import { euros, hhmm, statusColor } from "../utils";
import { ReservationOpsPanel } from "./ReservationOpsPanel";
import { StoreReservationPaymentsHistory } from "./StoreReservationPaymentsHistory";

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
  completeReturn: (input: CompleteReturnInput) => Promise<void>;
  cancelReservation: (reservationId: string, opts: { refund: boolean; method: PayMethod }) => Promise<void>;
};

function toneFromStatus(r: ReservationRow) {
  if (r.storeFlowStage === "RETURN_PENDING_CLOSE") return "warning" as const;
  const color = statusColor(r.status);
  if (color === "#dcfce7") return "success" as const;
  if (color === "#fee2e2") return "danger" as const;
  if (color === "#ffedd5") return "warning" as const;
  if (color === "#e5e7eb") return "neutral" as const;
  return "info" as const;
}

function depositLabel(depositStatus: "RETENIDA" | "PENDIENTE" | "LIBERABLE" | "DEVUELTA") {
  if (depositStatus === "PENDIENTE") return "Fianza pendiente";
  if (depositStatus === "LIBERABLE") return "Fianza liberable";
  if (depositStatus === "DEVUELTA") return "Fianza devuelta";
  return "Fianza retenida";
}

function depositTone(depositStatus: "RETENIDA" | "PENDIENTE" | "LIBERABLE" | "DEVUELTA") {
  if (depositStatus === "PENDIENTE") return "danger" as const;
  if (depositStatus === "LIBERABLE") return "warning" as const;
  if (depositStatus === "DEVUELTA") return "success" as const;
  return "neutral" as const;
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
    cancelReservation,
  } = props;

  const router = useRouter();
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementMode, setSettlementMode] = useState<ReturnSettlementMode>("FULL_REFUND");
  const [partialRefundEuros, setPartialRefundEuros] = useState("");
  const [retainReason, setRetainReason] = useState("");

  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const deposit = Number(r.depositCents ?? 0);
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const pendingTotal = pendingService + pendingDeposit;
  const hasDepositIn = (r.payments ?? []).some((p) => p.isDeposit && p.direction !== "OUT");
  const hasDepositOut = (r.payments ?? []).some((p) => p.isDeposit && p.direction === "OUT");
  const depositHeld = r.depositHeld === true;
  const paid = Number(r.paidCents ?? 0);
  const refundableDepositCents = Math.max(0, paidDepositCents);
  const hasRefundableAmount = paid > 0;
  const depositStatus = depositHeld
    ? "RETENIDA"
    : paidDepositCents <= 0
      ? hasDepositIn && hasDepositOut
        ? "DEVUELTA"
        : "PENDIENTE"
      : "LIBERABLE";
  const isFullyPaid = pendingTotal === 0;
  const canAutoCloseReturned = refundableDepositCents === 0 || depositHeld;

  const partialRefundCents = useMemo(() => {
    const raw = Number(String(partialRefundEuros ?? "").replace(",", "."));
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  }, [partialRefundEuros]);

  async function submitReturnSettlement() {
    setError(null);

    if (canAutoCloseReturned) {
      await completeReturn({ reservationId: r.id, settlementMode: "AUTO" });
      return;
    }

    if (settlementMode === "FULL_REFUND") {
      await completeReturn({
        reservationId: r.id,
        settlementMode: "FULL_REFUND",
        refundMethod: method,
      });
      return;
    }

    if (settlementMode === "PARTIAL_REFUND") {
      if (partialRefundCents <= 0 || partialRefundCents >= refundableDepositCents) {
        setError("La devolución parcial debe ser mayor que 0 y menor que la fianza liberable.");
        return;
      }
      if (!retainReason.trim()) {
        setError("Indica el motivo de la retención parcial.");
        return;
      }
      await completeReturn({
        reservationId: r.id,
        settlementMode: "PARTIAL_REFUND",
        refundAmountCents: partialRefundCents,
        refundMethod: method,
        retainReason: retainReason.trim(),
      });
      return;
    }

    if (!retainReason.trim()) {
      setError("Indica el motivo de la retención.");
      return;
    }

    await completeReturn({
      reservationId: r.id,
      settlementMode: "RETAIN_ALL",
      retainReason: retainReason.trim(),
    });
  }

  return (
    <div style={{ padding: 12, border: "1px solid #d9e2ec", borderRadius: 16, background: "#fff" }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong>{r.customerName || "Sin nombre"}</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{hhmm(r.scheduledTime) || "sin hora"}</span>
            <StatusBadge tone={toneFromStatus(r)}>{r.storeFlowStage === "RETURN_PENDING_CLOSE" ? "Devuelta" : r.status}</StatusBadge>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => router.push(`/store/create?editFrom=${r.id}`)} style={btnSecondary}>
              Reagendar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!hasRefundableAmount) {
                  if (!window.confirm("¿Cancelar esta reserva?")) return;
                  await cancelReservation(r.id, { refund: false, method });
                  return;
                }

                const refund = window.confirm(
                  `La reserva tiene cobros registrados. Aceptar = cancelar y devolver usando ${method}. Cancelar = seguir sin devolución.`,
                );
                if (!refund && !window.confirm("¿Confirmas cancelar sin devolución?")) return;
                await cancelReservation(r.id, { refund, method });
              }}
              style={{ ...btnSecondary, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b" }}
            >
              Cancelar
            </button>
            <ActionButton type="button" onClick={onToggleOpen} variant="secondary">
              {isOpen ? "Cerrar" : "Abrir"}
            </ActionButton>
          </div>
        </div>

        {showReturnedBanner && r.arrivalAt ? (
          <AlertBanner tone="warning" title="Devuelta">
            {new Date(r.arrivalAt).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </AlertBanner>
        ) : null}

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {r.serviceName ?? "Servicio"}
          {r.durationMinutes ? ` · ${r.durationMinutes} min` : ""}
        </div>
      </div>

      {r.platformExtrasPendingCount ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <StatusBadge tone="info">Extras plataforma: {r.platformExtrasPendingCount}</StatusBadge>
          <button type="button" onClick={() => void applyPlatformExtras(r.id)} style={btnSecondary}>
            Aplicar extras
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <StatusBadge tone="warning">Fianza {euros(Math.min(paidDepositCents, deposit))}</StatusBadge>
        <StatusBadge tone={depositTone(depositStatus)}>{depositLabel(depositStatus)}</StatusBadge>
        {pendingTotal > 0 ? <StatusBadge tone="danger">Pendiente {euros(pendingTotal)}</StatusBadge> : <StatusBadge tone="success">Todo cobrado</StatusBadge>}
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
          {isFullyPaid ? <StatusBadge tone="success">Pagado</StatusBadge> : null}
        </div>
      </div>

      {r.depositHeld ? (
        <div style={{ marginTop: 8 }}>
          <AlertBanner tone="danger" title="Incidencia con fianza retenida">
            {r.depositHoldReason || "Retenida por incidencia registrada desde plataforma."}
          </AlertBanner>
        </div>
      ) : null}

      {showReturnedActions && r.status === "WAITING" && r.arrivalAt ? (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed #ddd",
            display: "grid",
            gap: 10,
          }}
        >
          {canAutoCloseReturned ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <ActionButton
                type="button"
                onClick={() => void completeReturn({ reservationId: r.id, settlementMode: "AUTO" })}
                variant="primary"
              >
                Cerrar devolución
              </ActionButton>
            </div>
          ) : (
            <>
              {!settlementOpen ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ActionButton
                    type="button"
                    onClick={() => {
                      setSettlementOpen(true);
                      setError(null);
                    }}
                    variant="primary"
                  >
                    Resolver fianza y cerrar
                  </ActionButton>
                </div>
              ) : null}

              {settlementOpen ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Liquidación final de fianza</div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    Fianza liberable pendiente: <strong>{euros(refundableDepositCents)}</strong>.
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="radio" checked={settlementMode === "FULL_REFUND"} onChange={() => setSettlementMode("FULL_REFUND")} />
                      <span>Devolver toda la fianza</span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="radio" checked={settlementMode === "PARTIAL_REFUND"} onChange={() => setSettlementMode("PARTIAL_REFUND")} />
                      <span>Devolver una parte y retener el resto</span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="radio" checked={settlementMode === "RETAIN_ALL"} onChange={() => setSettlementMode("RETAIN_ALL")} />
                      <span>Retener toda la fianza</span>
                    </label>
                  </div>

                  {(settlementMode === "FULL_REFUND" || settlementMode === "PARTIAL_REFUND") ? (
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "180px 1fr", alignItems: "center" }}>
                      <div style={{ fontSize: 13, color: "#475569" }}>Método de devolución</div>
                      <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}>
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="BIZUM">Bizum</option>
                        <option value="TRANSFER">Transferencia</option>
                      </select>
                    </div>
                  ) : null}

                  {settlementMode === "PARTIAL_REFUND" ? (
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "180px 1fr", alignItems: "center" }}>
                      <div style={{ fontSize: 13, color: "#475569" }}>Importe a devolver</div>
                      <input
                        value={partialRefundEuros}
                        onChange={(e) => setPartialRefundEuros(e.target.value)}
                        placeholder="Ej: 50,00"
                        style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                      />
                    </div>
                  ) : null}

                  {(settlementMode === "PARTIAL_REFUND" || settlementMode === "RETAIN_ALL") ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 13, color: "#475569" }}>Motivo de la retención</div>
                      <textarea
                        value={retainReason}
                        onChange={(e) => setRetainReason(e.target.value)}
                        rows={3}
                        placeholder="Ej: arañazo en casco, pérdida de accesorio, incidencia pendiente de revisar..."
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db", resize: "vertical" }}
                      />
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementOpen(false);
                        setError(null);
                      }}
                      style={btnSecondary}
                    >
                      Cancelar
                    </button>
                    <ActionButton type="button" onClick={() => void submitReturnSettlement()} variant="primary">
                      Resolver y cerrar
                    </ActionButton>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <StoreReservationPaymentsHistory payments={r.payments ?? []} />

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
