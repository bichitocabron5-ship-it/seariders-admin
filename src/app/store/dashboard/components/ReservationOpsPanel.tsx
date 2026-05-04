// src/app/store/dashboard/components/ReservationOpsPanel.tsx
"use client";

import type React from "react";
import { useRef, useState } from "react";

import CashChangeHelper from "@/components/cash-change-helper";
import { ActionButton, AlertBanner, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

import type { ExtraUiMap, PayLine, PayMethod, ReservationRow, Service } from "../types";
import { centsFromEuros, errorMessage, euros } from "../utils";

type ReservationOpsPanelProps = {
  r: ReservationRow;
  isCashClosed: boolean;
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
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
  reloadDashboard: () => Promise<void>;
  setError: (msg: string | null) => void;
  servicesExtra: Service[];
  extraUi: ExtraUiMap;
  setExtraUi: React.Dispatch<React.SetStateAction<ExtraUiMap>>;
  getExtraState: (
    reservationId: string,
    servicesExtra: Service[],
    extraUi: ExtraUiMap
  ) => { extraServiceId: string; qty: number };
  addExtraToReservation: (reservationId: string) => Promise<void>;
  servicePayLines: PayLine[];
  addServicePayLine: () => void;
  removeServicePayLine: (idx: number) => void;
  updateServicePayLine: (idx: number, patch: Partial<PayLine>) => void;
  chargeServiceSplit: (reservationId: string, maxServiceCents: number) => Promise<void>;
};

const inputBase: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: `1px solid ${brand.colors.border}`,
  background: "#fff",
};

const surfaceCard: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: 12,
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 14,
  background: brand.colors.surfaceSoft,
};

export function ReservationOpsPanel({
  r,
  isCashClosed,
  method,
  setMethod,
  createPayment,
  reloadDashboard,
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
}: ReservationOpsPanelProps) {
  const [fullCashReceivedEuros, setFullCashReceivedEuros] = useState("");
  const [depositPayLines, setDepositPayLines] = useState<PayLine[]>([
    { amountEuros: "", method: "CASH", receivedEuros: "" },
  ]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busyActionRef = useRef<string | null>(null);
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const autoDisc = Number(r.autoDiscountCents ?? 0);
  const manualDisc = Number(r.manualDiscountCents ?? 0);
  const totalDiscount = autoDisc + manualDisc;
  const pvpTotal = Number(r.pvpTotalCents ?? 0);
  const finalTotal = Number(r.finalTotalCents ?? r.totalPriceCents ?? Math.max(0, pvpTotal - totalDiscount));
  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const refundableDepositCents = Math.max(0, paidDepositCents);
  const depositHeld = r.depositHeld === true;
  const depositHoldReason = r.depositHoldReason ?? null;
  const canRefundDeposit = refundableDepositCents > 0 && !depositHeld;
  const hasDepositFlow = pendingDeposit > 0 || refundableDepositCents > 0 || depositHeld;
  const isBusy = busyAction !== null;

  async function runBusy(action: string, work: () => Promise<void>) {
    if (busyActionRef.current) return;
    busyActionRef.current = action;
    setBusyAction(action);
    try {
      await work();
    } finally {
      busyActionRef.current = null;
      setBusyAction(null);
    }
  }

  function addDepositPayLine() {
    setDepositPayLines((prev) => [
      ...prev,
      { amountEuros: "", method: "CARD", receivedEuros: "" },
    ]);
  }

  function removeDepositPayLine(idx: number) {
    setDepositPayLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDepositPayLine(idx: number, patch: Partial<PayLine>) {
    setDepositPayLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  }

  async function chargeDepositSplit() {
    setError(null);

    const lines = depositPayLines
      .map((line) => ({
        ...line,
        amountCents: centsFromEuros(line.amountEuros),
      }))
      .filter((line) => line.amountCents > 0);

    if (lines.length === 0) {
      setError("Añade al menos un importe de fianza");
      return;
    }

    const sumCents = lines.reduce((acc, line) => acc + line.amountCents, 0);
    if (sumCents > pendingDeposit) {
      setError(`La suma (${euros(sumCents)}) supera la fianza pendiente (${euros(pendingDeposit)}).`);
      return;
    }

    try {
      for (const line of lines) {
        await createPayment(
          {
            reservationId: r.id,
            amountCents: line.amountCents,
            method: line.method,
            origin: "STORE",
            isDeposit: true,
          },
          { reload: false }
        );
      }

      setDepositPayLines([{ amountEuros: "", method: "CASH", receivedEuros: "" }]);
      await reloadDashboard();
    } catch (e: unknown) {
      setError(errorMessage(e, "Error cobrando fianza"));
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={surfaceCard}>
        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <div>PVP original: {euros(pvpTotal)}</div>
          <div>Descuento aplicado: -{euros(totalDiscount)}</div>
          <div>Total final servicio: {euros(finalTotal)}</div>
          <div>Pendiente servicio: {euros(pendingService)}</div>
          {pendingDeposit > 0 ? <div>Pendiente fianza: {euros(pendingDeposit)}</div> : null}
        </div>
      </div>

      {hasDepositFlow ? (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PayMethod)}
              disabled={isBusy}
              style={{ ...inputBase, cursor: isBusy ? "wait" : "pointer", padding: 8 }}
            >
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BIZUM">Bizum</option>
              <option value="TRANSFER">Transferencia</option>
            </select>

            <ActionButton
              type="button"
              disabled={!canRefundDeposit || isBusy}
              onClick={() =>
                void runBusy("refund-deposit", async () => {
                  await createPayment({
                    reservationId: r.id,
                    amountCents: refundableDepositCents,
                    method,
                    origin: "STORE",
                    isDeposit: true,
                    direction: "OUT",
                  });
                })
              }
              variant="secondary"
              style={{ opacity: !canRefundDeposit || isBusy ? 0.6 : 1, cursor: !canRefundDeposit || isBusy ? "not-allowed" : "pointer" }}
            >
              {busyAction === "refund-deposit" ? "Devolviendo..." : "Devolver fianza"}
            </ActionButton>
          </div>

          {depositHeld ? (
            <AlertBanner tone="warning" title="Fianza retenida">
              {depositHoldReason || "Marcada por plataforma. No se puede devolver desde tienda."}
            </AlertBanner>
          ) : null}

          {pendingDeposit > 0 ? (
        <div style={surfaceCard}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>Cobrar fianza (puede ser mixto)</div>
            {isCashClosed ? <StatusBadge tone="warning">Caja cerrada</StatusBadge> : null}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {depositPayLines.map((line, idx) => (
              <div
                key={`deposit-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 160px minmax(180px, 220px) 1fr",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <select
                  value={line.method}
                  disabled={isCashClosed || isBusy}
                  onChange={(e) => updateDepositPayLine(idx, { method: e.target.value as PayMethod })}
                  style={{ ...inputBase, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="BIZUM">Bizum</option>
                  <option value="TRANSFER">Transferencia</option>
                </select>

                <input
                  value={line.amountEuros}
                  disabled={isCashClosed || isBusy}
                  onChange={(e) => updateDepositPayLine(idx, { amountEuros: e.target.value })}
                  placeholder="Importe EUR"
                  style={{
                    ...inputBase,
                    textAlign: "right",
                    fontWeight: 700,
                    cursor: isCashClosed || isBusy ? "not-allowed" : "text",
                    background: isCashClosed || isBusy ? "#f3f4f6" : "white",
                  }}
                />

                {line.method === "CASH" ? (
                  <CashChangeHelper
                    amountEuros={line.amountEuros}
                    receivedEuros={line.receivedEuros ?? ""}
                    onReceivedEurosChange={(value) => updateDepositPayLine(idx, { receivedEuros: value })}
                  />
                ) : (
                  <div />
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {depositPayLines.length > 1 ? (
                    <ActionButton
                      type="button"
                      disabled={isCashClosed || isBusy}
                      onClick={() => removeDepositPayLine(idx)}
                      variant="secondary"
                      style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
                    >
                      Quitar
                    </ActionButton>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
            <ActionButton
              type="button"
              disabled={isCashClosed || isBusy}
              onClick={addDepositPayLine}
              variant="secondary"
              style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
            >
              + Añadir pago
            </ActionButton>
            <ActionButton
              type="button"
              disabled={isCashClosed || isBusy}
              onClick={() => void runBusy("charge-deposit", chargeDepositSplit)}
              variant="primary"
              style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
            >
              {isCashClosed ? "Caja cerrada" : busyAction === "charge-deposit" ? "Cobrando..." : "Cobrar fianza"}
            </ActionButton>
          </div>
        </div>
          ) : null}
        </>
      ) : null}

      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Extras</div>
        {r.source === "BOOTH" ? (
          <AlertBanner tone="info" title="Reserva Booth">
            En reservas de Booth, añadir extras o actividades nuevas no amplía el descuento heredado. Solo escala si se aumenta la misma actividad base con la que llegó la reserva.
          </AlertBanner>
        ) : null}
        {r.extras && r.extras.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 6 }}>
            {r.extras.map((ex) => (
              <StatusBadge key={ex.id} tone="neutral">
                {ex.serviceName} × {ex.quantity} ({euros(ex.totalPriceCents)})
              </StatusBadge>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Sin extras</div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 120px",
            gap: 6,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <select
            value={getExtraState(r.id, servicesExtra, extraUi).extraServiceId}
            onChange={(e) =>
              setExtraUi((prev) => ({
                ...prev,
                [r.id]: {
                  ...getExtraState(r.id, servicesExtra, prev),
                  extraServiceId: e.target.value,
                },
              }))
            }
            style={{ ...inputBase, padding: 8, fontSize: 13 }}
          >
            {servicesExtra.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={20}
            value={getExtraState(r.id, servicesExtra, extraUi).qty}
            onChange={(e) =>
              setExtraUi((prev) => ({
                ...prev,
                [r.id]: {
                  ...getExtraState(r.id, servicesExtra, prev),
                  qty: Math.max(1, Number(e.target.value || 1)),
                },
              }))
            }
            style={{ ...inputBase, padding: 8, fontSize: 13 }}
          />

          <ActionButton
            type="button"
            disabled={isBusy}
            onClick={() => void runBusy("add-extra", async () => addExtraToReservation(r.id))}
            variant="secondary"
            style={{ fontSize: 13, cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1 }}
          >
            Añadir
          </ActionButton>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          width: "100%",
          opacity: isCashClosed ? 0.6 : 1,
        }}
      >
        {pendingService > 0 ? (
          <div style={surfaceCard}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>Cobrar servicio (puede ser mixto)</div>
              {isCashClosed ? <StatusBadge tone="warning">Caja cerrada</StatusBadge> : null}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {servicePayLines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 160px minmax(180px, 220px) 1fr",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <select
                    value={line.method}
                    disabled={isCashClosed || isBusy}
                    onChange={(e) => updateServicePayLine(idx, { method: e.target.value as PayMethod })}
                    style={{ ...inputBase, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="BIZUM">Bizum</option>
                    <option value="TRANSFER">Transferencia</option>
                  </select>

                  <input
                    value={line.amountEuros}
                    disabled={isCashClosed || isBusy}
                    onChange={(e) => updateServicePayLine(idx, { amountEuros: e.target.value })}
                    placeholder="Importe EUR"
                    style={{
                      ...inputBase,
                      textAlign: "right",
                      fontWeight: 700,
                      cursor: isCashClosed || isBusy ? "not-allowed" : "text",
                      background: isCashClosed || isBusy ? "#f3f4f6" : "white",
                    }}
                  />

                  {line.method === "CASH" ? (
                    <CashChangeHelper
                      amountEuros={line.amountEuros}
                      receivedEuros={line.receivedEuros ?? ""}
                      onReceivedEurosChange={(value) => updateServicePayLine(idx, { receivedEuros: value })}
                    />
                  ) : (
                    <div />
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {servicePayLines.length > 1 ? (
                      <ActionButton
                        type="button"
                        disabled={isCashClosed || isBusy}
                        onClick={() => removeServicePayLine(idx)}
                        variant="secondary"
                        style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
                      >
                        Quitar
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
              <ActionButton
                type="button"
                disabled={isCashClosed || isBusy}
                onClick={addServicePayLine}
                variant="secondary"
                style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
              >
                + Añadir pago
              </ActionButton>
              <ActionButton
                type="button"
                disabled={isCashClosed || isBusy}
                onClick={() => void runBusy("charge-service", async () => chargeServiceSplit(r.id, pendingService))}
                variant="primary"
                style={{ opacity: isCashClosed || isBusy ? 0.6 : 1, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
              >
                {isCashClosed ? "Caja cerrada" : busyAction === "charge-service" ? "Cobrando..." : "Cobrar servicio"}
              </ActionButton>
            </div>
          </div>
        ) : null}

        <ActionButton
          type="button"
          disabled={isCashClosed || isBusy || (pendingService <= 0 && pendingDeposit <= 0)}
          onClick={() =>
            void runBusy("charge-all", async () => {
              try {
                if (pendingDeposit > 0) {
                  await createPayment(
                    {
                      reservationId: r.id,
                      amountCents: pendingDeposit,
                      method,
                      origin: "STORE",
                      isDeposit: true,
                    },
                    { reload: false }
                  );
                }
                if (pendingService > 0) {
                  await createPayment(
                    {
                      reservationId: r.id,
                      amountCents: pendingService,
                      method,
                      origin: "STORE",
                      isDeposit: false,
                    },
                    { reload: false }
                  );
                }
                setFullCashReceivedEuros("");
                await reloadDashboard();
              } catch (e: unknown) {
                setError(errorMessage(e, "Error cobrando todo"));
              }
            })
          }
          variant="primary"
          style={{
            opacity: isCashClosed || isBusy || (pendingService <= 0 && pendingDeposit <= 0) ? 0.5 : 1,
            cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
          }}
        >
          {isCashClosed ? "Caja cerrada" : busyAction === "charge-all" ? "Cobrando..." : "Cobrar todo"}
        </ActionButton>

        {!isCashClosed && method === "CASH" && pendingService + pendingDeposit > 0 ? (
          <div style={{ width: "100%", maxWidth: 320 }}>
            <CashChangeHelper
              amountEuros={((pendingService + pendingDeposit) / 100).toFixed(2)}
              receivedEuros={fullCashReceivedEuros}
              onReceivedEurosChange={setFullCashReceivedEuros}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
