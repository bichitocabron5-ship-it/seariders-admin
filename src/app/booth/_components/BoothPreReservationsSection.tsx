"use client";

import CashChangeHelper from "@/components/cash-change-helper";

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
  cardStyle,
  darkBtn,
  ghostBtn,
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
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Pre-reservas de hoy</h2>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Pendientes de asignación a viaje y cobro parcial antes de salir.
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {preReservationRows.map((reservation) => {
          const received = !!reservation.arrivedStoreAt;
          const assigned = !!reservation.taxiboatTripId;
          const departed = !!reservation.taxiboatDepartedAt;
          const preparing = assigned && !departed && !received;
          const enCamino = assigned && departed && !received;
          const waitMeta = getWaitMeta(reservation);
          const label = received ? "RECIBIDO" : enCamino ? "EN CAMINO" : preparing ? "PREPARANDO" : "";
          const bg = received ? "#dcfce7" : enCamino ? "#fef9c3" : preparing ? "#e0f2fe" : "transparent";

          return (
            <div
              key={reservation.id}
              style={{
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{reservation.customerName}</strong>
                <span style={{ fontWeight: 800 }}>{reservation.boothCode}</span>
              </div>

              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                {formatReservationLine(reservation, { showCountry: true })}
              </div>

              {reservation.boothNote ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid #dbeafe",
                    background: "#f8fbff",
                    fontSize: 13,
                    color: "#334155",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>Nota:</strong> {reservation.boothNote}
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
                <div
                  style={{
                    marginTop: 8,
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
                </div>
              ) : null}

              {!received ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {!assigned ? (
                    <button
                      type="button"
                      onClick={() => void assignToActiveTrip(reservation.id)}
                      disabled={!activeTripId}
                      style={{
                        ...darkBtn,
                        width: "100%",
                        opacity: activeTripId ? 1 : 0.5,
                        cursor: activeTripId ? "pointer" : "not-allowed",
                      }}
                    >
                      {activeTripId ? "Añadir al viaje" : "Selecciona un viaje OPEN"}
                    </button>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", width: "fit-content" }}>
                        Asignado a viaje
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void unassignReservationFromTrip(reservation.id)}
                          disabled={reservationActionId === `unassign:${reservation.id}`}
                          style={{ ...ghostBtn, opacity: reservationActionId === `unassign:${reservation.id}` ? 0.6 : 1 }}
                        >
                          {reservationActionId === `unassign:${reservation.id}` ? "Desasignando..." : "Desasignar viaje"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelReservation(reservation.id)}
                          disabled={reservationActionId === `cancel:${reservation.id}`}
                          style={{
                            ...ghostBtn,
                            borderColor: "#fecaca",
                            background: "#fff1f2",
                            color: "#991b1b",
                            opacity: reservationActionId === `cancel:${reservation.id}` ? 0.6 : 1,
                          }}
                        >
                          {reservationActionId === `cancel:${reservation.id}` ? "Cancelando..." : "Cancelar reserva"}
                        </button>
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
                  <button
                    type="button"
                    onClick={() => void cancelReservation(reservation.id)}
                    disabled={reservationActionId === `cancel:${reservation.id}`}
                    style={{
                      ...ghostBtn,
                      borderColor: "#fecaca",
                      background: "#fff1f2",
                      color: "#991b1b",
                      opacity: reservationActionId === `cancel:${reservation.id}` ? 0.6 : 1,
                    }}
                  >
                    {reservationActionId === `cancel:${reservation.id}` ? "Cancelando..." : "Cancelar reserva"}
                  </button>
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
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
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

                  <button
                    onClick={() => paySplitNow(reservation.id, reservation.pendingCents ?? 0)}
                    disabled={payingId === reservation.id || isCashClosed}
                    style={{
                      ...darkBtn,
                      width: "100%",
                      opacity: payingId === reservation.id || isCashClosed ? 0.5 : 1,
                      cursor: isCashClosed ? "not-allowed" : "pointer",
                    }}
                  >
                    {isCashClosed ? "Caja cerrada" : payingId === reservation.id ? "Cobrando..." : "Cobrar (split)"}
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Pendiente: <strong>{euros(reservation.pendingCents ?? 0)}</strong> · Se pueden usar 1 o 2 líneas.
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {label ? <span style={{ padding: "4px 8px", borderRadius: 999, background: bg, fontSize: 12 }}>{label}</span> : <span />}
              </div>
            </div>
          );
        })}

        {preReservationRows.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No hay pre-reservas pendientes de asignación.</div>
        ) : null}
      </div>
    </section>
  );
}
