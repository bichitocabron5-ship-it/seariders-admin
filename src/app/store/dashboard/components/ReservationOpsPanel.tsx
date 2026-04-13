// src/app/store/dashboard/components/ReservationOpsPanel.tsx
"use client";

import type React from "react";
import { useState } from "react";

import CashChangeHelper from "@/components/cash-change-helper";

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
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const refundableDepositCents = Math.max(0, paidDepositCents);
  const depositHeld = r.depositHeld === true;
  const depositHoldReason = r.depositHoldReason ?? null;
  const canRefundDeposit = refundableDepositCents > 0 && !depositHeld;
  const isBusy = busyAction !== null;

  async function runBusy(action: string, work: () => Promise<void>) {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await work();
    } finally {
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
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PayMethod)}
          disabled={isBusy}
          style={{ padding: 6, cursor: isBusy ? "wait" : "pointer" }}
        >
          <option value="CASH">Efectivo</option>
          <option value="CARD">Tarjeta</option>
          <option value="BIZUM">Bizum</option>
          <option value="TRANSFER">Transferencia</option>
        </select>

        <button
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
          style={{ padding: "6px 10px", cursor: !canRefundDeposit || isBusy ? "not-allowed" : "pointer" }}
        >
          {busyAction === "refund-deposit" ? "Devolviendo..." : "Devolver fianza"}
        </button>
      </div>

      {depositHeld ? (
        <div style={{ padding: 10, background: "#f3f4f6", borderRadius: 10 }}>
          <div style={{ fontWeight: 700 }}>Fianza retenida</div>
          {depositHoldReason ? (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer" }}>Ver motivo</summary>
              <div style={{ marginTop: 6, opacity: 0.85 }}>{depositHoldReason}</div>
            </details>
          ) : (
            <div style={{ marginTop: 6, opacity: 0.75 }}>
              Marcada por plataforma. No se puede devolver desde tienda.
            </div>
          )}
        </div>
      ) : null}

      {pendingDeposit > 0 ? (
        <div
          style={{
            width: "100%",
            marginTop: 6,
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Cobrar fianza (puede ser mixto)
            {isCashClosed ? (
              <span style={{ marginLeft: 8, fontWeight: 700, opacity: 0.8 }}>· Caja cerrada</span>
            ) : null}
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
                  style={{ padding: 10, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
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
                    padding: 10,
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
                    <button
                      type="button"
                      disabled={isCashClosed || isBusy}
                      onClick={() => removeDepositPayLine(idx)}
                      style={{
                        padding: "8px 12px",
                        opacity: isCashClosed || isBusy ? 0.6 : 1,
                        cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              disabled={isCashClosed || isBusy}
              onClick={addDepositPayLine}
              style={{
                padding: "8px 12px",
                opacity: isCashClosed || isBusy ? 0.6 : 1,
                cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
              }}
            >
              + Añadir pago
            </button>
            <button
              type="button"
              disabled={isCashClosed || isBusy}
              onClick={() => void runBusy("charge-deposit", chargeDepositSplit)}
              style={{
                padding: "10px 14px",
                fontWeight: 800,
                opacity: isCashClosed || isBusy ? 0.6 : 1,
                cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isCashClosed ? "Caja cerrada" : busyAction === "charge-deposit" ? "Cobrando..." : "Cobrar fianza"}
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Extras</div>
        {r.source === "BOOTH" ? (
          <div
            style={{
              marginBottom: 8,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #bae6fd",
              background: "#f0f9ff",
              color: "#0c4a6e",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            En reservas de Booth, añadir extras o actividades nuevas no amplía el descuento heredado. Solo escala si se aumenta la misma actividad base con la que llegó la reserva.
          </div>
        ) : null}
        {r.extras && r.extras.length > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {r.extras.map((ex) => (
              <span
                key={ex.id}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                  background: "#fafafa",
                }}
              >
                {ex.serviceName} × {ex.quantity} ({euros(ex.totalPriceCents)})
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Sin extras</div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 100px",
            gap: 6,
            alignItems: "center",
            marginTop: 4,
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
            style={{ padding: 6, fontSize: 13 }}
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
            style={{ padding: 6, fontSize: 13 }}
          />

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void runBusy("add-extra", async () => addExtraToReservation(r.id))}
            style={{ padding: "6px 10px", fontSize: 13, cursor: isBusy ? "not-allowed" : "pointer" }}
          >
            Añadir
          </button>
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
          <div
            style={{
              width: "100%",
              marginTop: 6,
              padding: 10,
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Cobrar servicio (puede ser mixto)
              {isCashClosed ? (
                <span style={{ marginLeft: 8, fontWeight: 700, opacity: 0.8 }}>· Caja cerrada</span>
              ) : null}
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
                    onChange={(e) =>
                      updateServicePayLine(idx, { method: e.target.value as PayMethod })
                    }
                    style={{ padding: 10, cursor: isCashClosed || isBusy ? "not-allowed" : "pointer" }}
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
                      padding: 10,
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
                      onReceivedEurosChange={(value) =>
                        updateServicePayLine(idx, { receivedEuros: value })
                      }
                    />
                  ) : (
                    <div />
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {servicePayLines.length > 1 ? (
                      <button
                        type="button"
                        disabled={isCashClosed || isBusy}
                        onClick={() => removeServicePayLine(idx)}
                        style={{
                          padding: "8px 12px",
                          opacity: isCashClosed || isBusy ? 0.6 : 1,
                          cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                disabled={isCashClosed || isBusy}
                onClick={addServicePayLine}
                style={{
                  padding: "8px 12px",
                  opacity: isCashClosed || isBusy ? 0.6 : 1,
                  cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
                }}
              >
                + Añadir pago
              </button>
              <button
                type="button"
                disabled={isCashClosed || isBusy}
                onClick={() => void runBusy("charge-service", async () => chargeServiceSplit(r.id, pendingService))}
                style={{
                  padding: "10px 14px",
                  fontWeight: 800,
                  opacity: isCashClosed || isBusy ? 0.6 : 1,
                  cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
                }}
              >
                {isCashClosed ? "Caja cerrada" : busyAction === "charge-service" ? "Cobrando..." : "Cobrar servicio"}
              </button>
            </div>
          </div>
        ) : null}

        <button
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
          style={{
            padding: "6px 10px",
            opacity: isCashClosed || isBusy || (pendingService <= 0 && pendingDeposit <= 0) ? 0.5 : 1,
            cursor: isCashClosed || isBusy ? "not-allowed" : "pointer",
          }}
        >
          {isCashClosed ? "Caja cerrada" : busyAction === "charge-all" ? "Cobrando..." : "Cobrar todo"}
        </button>

        {!isCashClosed && method === "CASH" && pendingService + pendingDeposit > 0 ? (
          <div style={{ width: "100%", maxWidth: 240 }}>
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
