"use client";

import type React from "react";
import CashChangeHelper from "@/components/cash-change-helper";
import { ActionButton, AlertBanner, SectionCard, StatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

type SplitLine = { amount: string; method: PayMethod; received?: string };

type ReservationLike = {
  id: string;
  customerName?: string | null;
  customerCountry?: string | null;
  boothCode?: string | null;
  boothNote?: string | null;
  quantity?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  paidCents?: number | null;
  pendingCents?: number | null;
  arrivedStoreAt?: string | null;
  taxiboatTripId?: string | null;
  taxiboatDepartedAt?: string | null;
  taxiboatAssignedAt?: string | null;
  service?: { name?: string | null; code?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

type WaitMeta = {
  waitMs: number;
  isWarn: boolean;
  isCritical: boolean;
  bg: string;
  fg: string;
  bd: string;
  label: string;
} | null;

type Props = {
  cardStyle: React.CSSProperties;
  darkBtn: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  fieldStyle: React.CSSProperties;
  preReservationRows: ReservationLike[];
  activeTripId: string;
  activeTripLabel: string;
  payingId: string | null;
  isCashClosed: boolean;
  reservationActionId: string | null;
  getSplit: (id: string) => [SplitLine, SplitLine];
  setSplitLine: (id: string, idx: 0 | 1, patch: Partial<SplitLine>) => void;
  assignToActiveTrip: (reservationId: string) => void | Promise<void>;
  unassignReservationFromTrip: (reservationId: string) => void | Promise<void>;
  cancelReservation: (reservationId: string) => void | Promise<void>;
  paySplitNow: (reservationId: string, pendingCents: number) => void | Promise<void>;
  euros: (cents: number) => string;
  formatReservationLine: (reservation: ReservationLike, opts?: { showCountry?: boolean }) => string;
  getWaitMeta: (reservation: ReservationLike) => WaitMeta;
};

export default function BoothPreReservationsSection({
  fieldStyle,
  preReservationRows,
  activeTripId,
  activeTripLabel,
  payingId,
  isCashClosed,
  reservationActionId,
  getSplit,
  setSplitLine,
  assignToActiveTrip,
  unassignReservationFromTrip,
  cancelReservation,
  paySplitNow,
  euros,
  formatReservationLine,
  getWaitMeta,
}: Props) {
  return (
    <SectionCard eyebrow="Booth" title="Pre-reservas de hoy">
      <div style={{ display: "grid", gap: 10 }}>
        {preReservationRows.map((reservation) => {
          const received = !!reservation.arrivedStoreAt;
          const assigned = !!reservation.taxiboatTripId;
          const departed = !!reservation.taxiboatDepartedAt;
          const preparing = assigned && !departed && !received;
          const enCamino = assigned && departed && !received;
          const waitMeta = getWaitMeta(reservation);
          const label = received ? "RECIBIDO" : enCamino ? "EN CAMINO" : preparing ? "PREPARANDO" : "";

          return (
            <div
              key={reservation.id}
              style={{
                padding: 16,
                border: `1px solid ${brand.colors.border}`,
                borderRadius: 18,
                background: brand.colors.surface,
                boxShadow: brand.shadow.sm,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{reservation.customerName}</strong>
                <StatusBadge tone="neutral">{reservation.boothCode}</StatusBadge>
              </div>

              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                {formatReservationLine(reservation, { showCountry: true })}
              </div>

              {reservation.boothNote ? (
                <div style={{ marginTop: 10 }}>
                  <AlertBanner tone="info" title="Nota de Booth">
                    {reservation.boothNote}
                  </AlertBanner>
                </div>
              ) : null}

              <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 13 }}>
                  Total: <strong>{euros(reservation.totalPriceCents ?? 0)}</strong>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Pagado: <strong>{euros(reservation.paidCents ?? 0)}</strong>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Pendiente: <strong>{euros(reservation.pendingCents ?? 0)}</strong>
                </div>
              </div>

              {waitMeta ? (
                <div style={{ marginTop: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${waitMeta.bd}`,
                      background: waitMeta.bg,
                      color: waitMeta.fg,
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {waitMeta.label}
                  </span>
                </div>
              ) : null}

              {!received ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {!assigned ? (
                    <ActionButton
                      type="button"
                      onClick={() => void assignToActiveTrip(reservation.id)}
                      disabled={!activeTripId}
                      variant="primary"
                      style={{ width: "100%", opacity: activeTripId ? 1 : 0.5, cursor: activeTripId ? "pointer" : "not-allowed" }}
                    >
                      {activeTripId ? "Añadir al viaje" : "Selecciona un viaje OPEN"}
                    </ActionButton>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ width: "fit-content" }}>
                        <StatusBadge tone="info">Asignado a viaje</StatusBadge>
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <ActionButton
                          type="button"
                          onClick={() => void unassignReservationFromTrip(reservation.id)}
                          disabled={reservationActionId === `unassign:${reservation.id}`}
                          variant="secondary"
                          style={{ opacity: reservationActionId === `unassign:${reservation.id}` ? 0.6 : 1 }}
                        >
                          {reservationActionId === `unassign:${reservation.id}` ? "Desasignando..." : "Desasignar viaje"}
                        </ActionButton>
                        <ActionButton
                          type="button"
                          onClick={() => void cancelReservation(reservation.id)}
                          disabled={reservationActionId === `cancel:${reservation.id}`}
                          variant="secondary"
                          style={{ borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", opacity: reservationActionId === `cancel:${reservation.id}` ? 0.6 : 1 }}
                        >
                          {reservationActionId === `cancel:${reservation.id}` ? "Cancelando..." : "Cancelar reserva"}
                        </ActionButton>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Viaje activo: {activeTripLabel || activeTripId || "sin seleccionar"}
                  </div>
                </div>
              ) : null}

              {!received && !assigned ? (
                <div style={{ marginTop: 10 }}>
                  <ActionButton
                    type="button"
                    onClick={() => void cancelReservation(reservation.id)}
                    disabled={reservationActionId === `cancel:${reservation.id}`}
                    variant="secondary"
                    style={{ borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", opacity: reservationActionId === `cancel:${reservation.id}` ? 0.6 : 1 }}
                  >
                    {reservationActionId === `cancel:${reservation.id}` ? "Cancelando..." : "Cancelar reserva"}
                  </ActionButton>
                </div>
              ) : null}

              {!received && (reservation.pendingCents ?? 0) > 0 ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${brand.colors.border}`,
                    background: brand.colors.surfaceSoft,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a" }}>
                    Cobro parcial / split payment
                  </div>

                  {[0, 1].map((lineIndex) => {
                    const line = getSplit(reservation.id)[lineIndex as 0 | 1];
                    return (
                      <div
                        key={lineIndex}
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          alignItems: "start",
                        }}
                      >
                        <input
                          disabled={isCashClosed}
                          placeholder={`Importe EUR (${lineIndex + 1})`}
                          value={line.amount}
                          onChange={(e) => setSplitLine(reservation.id, lineIndex as 0 | 1, { amount: e.target.value })}
                          style={fieldStyle}
                        />
                        <select
                          disabled={isCashClosed}
                          value={line.method}
                          onChange={(e) =>
                            setSplitLine(reservation.id, lineIndex as 0 | 1, {
                              method: e.target.value as PayMethod,
                            })
                          }
                          style={fieldStyle}
                        >
                          <option value="CASH">Efectivo</option>
                          <option value="CARD">Tarjeta</option>
                          <option value="BIZUM">Bizum</option>
                          <option value="TRANSFER">Transfer</option>
                        </select>
                        {line.method === "CASH" ? (
                          <CashChangeHelper
                            amountEuros={line.amount}
                            receivedEuros={line.received ?? ""}
                            onReceivedEurosChange={(value) =>
                              setSplitLine(reservation.id, lineIndex as 0 | 1, { received: value })
                            }
                            inputStyle={fieldStyle}
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  <ActionButton
                    onClick={() => paySplitNow(reservation.id, reservation.pendingCents ?? 0)}
                    disabled={payingId === reservation.id || isCashClosed}
                    variant="primary"
                    style={{ width: "100%", opacity: payingId === reservation.id || isCashClosed ? 0.5 : 1, cursor: isCashClosed ? "not-allowed" : "pointer" }}
                  >
                    {isCashClosed ? "Caja cerrada" : payingId === reservation.id ? "Cobrando..." : "Cobrar (split)"}
                  </ActionButton>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Pendiente: <strong>{euros(reservation.pendingCents ?? 0)}</strong> · Se pueden usar 1 o 2 líneas.
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {label ? (
                  <StatusBadge tone={received ? "success" : enCamino ? "warning" : preparing ? "info" : "neutral"}>
                    {label}
                  </StatusBadge>
                ) : (
                  <span />
                )}
              </div>
            </div>
          );
        })}

        {preReservationRows.length === 0 ? (
          <AlertBanner tone="info" title="Sin pre-reservas pendientes">
            No hay pre-reservas pendientes de asignación.
          </AlertBanner>
        ) : null}
      </div>
    </SectionCard>
  );
}
