"use client";

type ReservationLike = {
  id: string;
  status?: string;
  customerName?: string | null;
  customerCountry?: string | null;
  boothCode?: string | null;
  arrivedStoreAt?: string | null;
  taxiboatAssignedAt?: string | null;
  taxiboatDepartedAt?: string | null;
  service?: { name?: string | null; code?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  quantity?: number | null;
  pax?: number | null;
};

type TripRow = {
  id: string;
  boat: "TAXIBOAT_1" | "TAXIBOAT_2" | string;
  tripNo?: number | null;
  status: string;
  paxTotal?: number | null;
  departedAt?: string | null;
  reservations?: ReservationLike[];
};

type TaxiboatOperationRow = {
  id: string;
  boat: "TAXIBOAT_1" | "TAXIBOAT_2" | string;
  status: "TO_PLATFORM" | "AT_PLATFORM" | "TO_BOOTH" | "AT_BOOTH" | string;
  departedBoothAt?: string | null;
  arrivedPlatformAt?: string | null;
  departedPlatformAt?: string | null;
  arrivedBoothAt?: string | null;
  updatedAt: string;
};

type ReturnMeta = {
  statusLabel: string;
  detail: string;
  bg: string;
  fg: string;
  bd: string;
} | null;

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
  activeBoat: "TAXIBOAT_1" | "TAXIBOAT_2";
  activeTripId: string;
  trips: TripRow[];
  taxiboatOpsByBoat: Map<string, TaxiboatOperationRow>;
  nowMs: number;
  setActiveBoat: (value: "TAXIBOAT_1" | "TAXIBOAT_2") => void;
  setActiveTripId: (value: string) => void;
  createTrip: () => void | Promise<void>;
  departTrip: (tripId: string) => void | Promise<void>;
  cancelTrip: (tripId: string) => void | Promise<void>;
  markArrivedBooth: (boat: "TAXIBOAT_1" | "TAXIBOAT_2") => void | Promise<void>;
  reservationActionId: string | null;
  tripActionId: string | null;
  unassignReservationFromTrip: (reservationId: string) => void | Promise<void>;
  cancelReservation: (reservationId: string) => void | Promise<void>;
  boatLabel: (boat?: string | null) => string;
  formatReservationLine: (reservation: ReservationLike, opts?: { showCountry?: boolean }) => string;
  getTaxiboatReturnMeta: (row: TaxiboatOperationRow, nowMs?: number) => ReturnMeta;
  getTaxiboatWaitMeta: (
    assignedAt?: string | null,
    departedAt?: string | null,
    arrivedStoreAt?: string | null,
    nowMs?: number
  ) => WaitMeta;
};

export default function BoothTripsSection({
  cardStyle,
  darkBtn,
  ghostBtn,
  fieldStyle,
  activeBoat,
  activeTripId,
  trips,
  taxiboatOpsByBoat,
  nowMs,
  setActiveBoat,
  setActiveTripId,
  createTrip,
  departTrip,
  cancelTrip,
  markArrivedBooth,
  reservationActionId,
  tripActionId,
  unassignReservationFromTrip,
  cancelReservation,
  boatLabel,
  formatReservationLine,
  getTaxiboatReturnMeta,
  getTaxiboatWaitMeta,
}: Props) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 22 }}>Taxiboat · Viajes</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Crea, prepara y despacha viajes del día. El retorno desde Platform se muestra por barco.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {(["TAXIBOAT_1", "TAXIBOAT_2"] as const).map((boat) => {
          const operation = taxiboatOpsByBoat.get(boat);
          const meta = operation ? getTaxiboatReturnMeta(operation, nowMs) : null;

          return (
            <div
              key={boat}
              style={{
                border: `1px solid ${meta?.bd ?? "#e5e7eb"}`,
                background: meta?.bg ?? "#fff",
                borderRadius: 16,
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{boatLabel(boat)}</div>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: `1px solid ${meta?.bd ?? "#e5e7eb"}`,
                    background: "#fff",
                    color: meta?.fg ?? "#475569",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {meta?.statusLabel ?? "SIN DATO"}
                </span>
              </div>

              <div style={{ fontSize: 13, color: meta?.fg ?? "#475569", fontWeight: 800 }}>
                {meta?.detail ?? "Sin estado operativo todavía."}
              </div>

              {operation?.status === "TO_BOOTH" ? (
                <button type="button" onClick={() => void markArrivedBooth(boat)} style={{ ...darkBtn, width: "100%" }}>
                  Marcar llegada a Booth
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
        <select value={activeBoat} onChange={(e) => setActiveBoat(e.target.value as "TAXIBOAT_1" | "TAXIBOAT_2")} style={fieldStyle}>
          <option value="TAXIBOAT_1">Taxiboat 1</option>
          <option value="TAXIBOAT_2">Taxiboat 2</option>
        </select>

        <button onClick={createTrip} style={{ ...darkBtn, width: "100%" }}>
          Crear viaje
        </button>

        <select value={activeTripId} onChange={(e) => setActiveTripId(e.target.value)} style={{ ...fieldStyle, minWidth: 260 }}>
          <option value="">(selecciona viaje OPEN)</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {boatLabel(trip.boat)}
              {trip.tripNo ? ` · Viaje ${trip.tripNo}` : ""}
              {` · ${trip.status} · PAX ${trip.paxTotal}`}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {trips.map((trip) => {
          const activeReservationsCount = (trip.reservations ?? []).filter((reservation) => reservation.status !== "CANCELED").length;
          const canDepart = activeReservationsCount > 0;

          return (
          <div key={trip.id} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>
                {boatLabel(trip.boat)} · Viaje {trip.tripNo} · PAX {trip.paxTotal}
              </div>
              {trip.status === "OPEN" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => void departTrip(trip.id)}
                    disabled={!canDepart || tripActionId === `depart:${trip.id}`}
                    style={{ ...ghostBtn, width: "100%", opacity: !canDepart || tripActionId === `depart:${trip.id}` ? 0.6 : 1 }}
                  >
                    {tripActionId === `depart:${trip.id}` ? "Marcando salida..." : "Marcar salida"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelTrip(trip.id)}
                    disabled={tripActionId === `cancel-trip:${trip.id}`}
                    style={{ ...ghostBtn, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", opacity: tripActionId === `cancel-trip:${trip.id}` ? 0.6 : 1 }}
                  >
                    {tripActionId === `cancel-trip:${trip.id}` ? "Anulando..." : "Desasignar taxiboat"}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Salió: {trip.departedAt ? new Date(trip.departedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </div>
              )}
            </div>

            {trip.status === "OPEN" && !canDepart ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
                No se puede marcar salida sin clientes asignados.
              </div>
            ) : null}

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {(trip.reservations ?? []).map((reservation) => {
                const canceled = reservation.status === "CANCELED";
                const grouped = !!reservation.taxiboatAssignedAt && !trip.departedAt && !reservation.arrivedStoreAt;
                const enCamino = !!trip.departedAt && !reservation.arrivedStoreAt;
                const received = !!reservation.arrivedStoreAt;
                const waitMeta = getTaxiboatWaitMeta(
                  reservation.taxiboatAssignedAt,
                  trip.departedAt ?? reservation.taxiboatDepartedAt,
                  reservation.arrivedStoreAt,
                  nowMs
                );
                const label = canceled ? "CANCELADA" : received ? "RECIBIDO" : enCamino ? "EN CAMINO" : grouped ? "AGRUPADO" : "PREPARANDO";
                const bg = canceled ? "#e2e8f0" : received ? "#dcfce7" : enCamino ? "#fef9c3" : grouped ? "#e0f2fe" : "#f3f4f6";

                return (
                  <div key={reservation.id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>
                        {reservation.customerName} · <span style={{ fontWeight: 900 }}>{reservation.boothCode}</span>
                      </div>
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: bg, fontSize: 12 }}>{label}</span>
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      {formatReservationLine(reservation, { showCountry: true })}
                    </div>

                    {!canceled && !received && trip.status === "OPEN" && !trip.departedAt ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void unassignReservationFromTrip(reservation.id)}
                          disabled={reservationActionId === `unassign:${reservation.id}`}
                          style={{ ...ghostBtn, opacity: reservationActionId === `unassign:${reservation.id}` ? 0.6 : 1 }}
                        >
                          {reservationActionId === `unassign:${reservation.id}` ? "Desasignando..." : "Quitar de la salida"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelReservation(reservation.id)}
                          disabled={reservationActionId === `cancel:${reservation.id}`}
                          style={{ ...ghostBtn, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", opacity: reservationActionId === `cancel:${reservation.id}` ? 0.6 : 1 }}
                        >
                          {reservationActionId === `cancel:${reservation.id}` ? "Cancelando..." : "Cancelar reserva"}
                        </button>
                      </div>
                    ) : null}

                    {!canceled && waitMeta ? (
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
                  </div>
                );
              })}

              {(trip.reservations ?? []).length === 0 ? <div style={{ opacity: 0.7 }}>Sin reservas asignadas.</div> : null}
            </div>
          </div>
        )})}
      </div>
    </section>
  );
}
