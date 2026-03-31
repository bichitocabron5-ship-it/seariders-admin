// src/app/store/dashboard/components/ReservationOpsPanel.tsx
"use client";

import type React from "react";
import { useState } from "react";

import CashChangeHelper from "@/components/cash-change-helper";

import type { ExtraUiMap, PayLine, PayMethod, ReservationRow, Service } from "../types";
import { errorMessage, euros } from "../utils";

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
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const refundableDepositCents = Math.max(0, paidDepositCents);
  const depositHeld = r.depositHeld === true;
  const depositHoldReason = r.depositHoldReason ?? null;
  const canRefundDeposit = refundableDepositCents > 0 && !depositHeld;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PayMethod)}
          style={{ padding: 6 }}
        >
          <option value="CASH">Efectivo</option>
          <option value="CARD">Tarjeta</option>
          <option value="BIZUM">Bizum</option>
          <option value="TRANSFER">Transferencia</option>
        </select>

        {pendingDeposit > 0 ? (
          <button
            type="button"
            onClick={() =>
              createPayment({
                reservationId: r.id,
                amountCents: pendingDeposit,
                method,
                origin: "STORE",
                isDeposit: true,
              })
            }
            style={{ padding: "6px 10px" }}
          >
            Cobrar fianza
          </button>
        ) : null}

        <button
          type="button"
          disabled={!canRefundDeposit}
          onClick={() =>
            createPayment({
              reservationId: r.id,
              amountCents: refundableDepositCents,
              method: "CASH",
              origin: "STORE",
              isDeposit: true,
              direction: "OUT",
            })
          }
          style={{ padding: "6px 10px" }}
        >
          Devolver fianza
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

      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Extras</div>
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
            onClick={() => addExtraToReservation(r.id)}
            style={{ padding: "6px 10px", fontSize: 13 }}
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
                    disabled={isCashClosed}
                    onChange={(e) =>
                      updateServicePayLine(idx, { method: e.target.value as PayMethod })
                    }
                    style={{ padding: 10, cursor: isCashClosed ? "not-allowed" : "pointer" }}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="BIZUM">Bizum</option>
                    <option value="TRANSFER">Transferencia</option>
                  </select>

                  <input
                    value={line.amountEuros}
                    disabled={isCashClosed}
                    onChange={(e) => updateServicePayLine(idx, { amountEuros: e.target.value })}
                    placeholder="Importe EUR"
                    style={{
                      padding: 10,
                      textAlign: "right",
                      fontWeight: 700,
                      cursor: isCashClosed ? "not-allowed" : "text",
                      background: isCashClosed ? "#f3f4f6" : "white",
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
                        disabled={isCashClosed}
                        onClick={() => removeServicePayLine(idx)}
                        style={{
                          padding: "8px 12px",
                          opacity: isCashClosed ? 0.6 : 1,
                          cursor: isCashClosed ? "not-allowed" : "pointer",
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
                disabled={isCashClosed}
                onClick={addServicePayLine}
                style={{
                  padding: "8px 12px",
                  opacity: isCashClosed ? 0.6 : 1,
                  cursor: isCashClosed ? "not-allowed" : "pointer",
                }}
              >
                + Añadir pago
              </button>
              <button
                type="button"
                disabled={isCashClosed}
                onClick={() => chargeServiceSplit(r.id, pendingService)}
                style={{
                  padding: "10px 14px",
                  fontWeight: 800,
                  opacity: isCashClosed ? 0.6 : 1,
                  cursor: isCashClosed ? "not-allowed" : "pointer",
                }}
              >
                {isCashClosed ? "Caja cerrada" : "Cobrar servicio"}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={isCashClosed || (pendingService <= 0 && pendingDeposit <= 0)}
          onClick={async () => {
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
          }}
          style={{
            padding: "6px 10px",
            opacity: isCashClosed || (pendingService <= 0 && pendingDeposit <= 0) ? 0.5 : 1,
            cursor: isCashClosed ? "not-allowed" : "pointer",
          }}
        >
          {isCashClosed ? "Caja cerrada" : "Cobrar todo"}
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
