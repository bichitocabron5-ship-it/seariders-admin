"use client";

type BoothRow = {
  id: string;
  boothCode: string | null;
  arrivedStoreAt: string | null;
  customerName: string;
  customerCountry: string;
  quantity: number;
  pax: number;
  totalPriceCents: number;
  service: { name: string };
  option: { durationMinutes: number };
};

type EnCaminoGroup = {
  key: string;
  boat: string;
  tripNo: number | null;
  departedAt: string | null | undefined;
  items: BoothRow[];
  paxTotal: number;
};

type Props = {
  enEspera: BoothRow[];
  groups: EnCaminoGroup[];
  enCamino: BoothRow[];
  recibidas: BoothRow[];
  lastMarkedId: string | null;
  euros: (cents: number) => string;
  hhmm: (iso?: string | null) => string;
  boatLabel: (boat?: string | null) => string;
};

export default function BoothTravelStatusSection({
  enEspera,
  groups,
  enCamino,
  recibidas,
  lastMarkedId,
  euros,
  hhmm,
  boatLabel,
}: Props) {
  return (
    <div style={columnsStyle}>
      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionTitle}>En espera en carpa</div>
            <div style={sectionSubtitle}>Reservas creadas que todavía no han salido hacia tienda.</div>
          </div>
          <div style={pillStyle}>{enEspera.length} pendientes</div>
        </div>

        {enEspera.length === 0 ? (
          <div style={emptyStateStyle}>No hay reservas esperando en carpa ahora mismo.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {enEspera.map((row) => (
              <article key={row.id} style={itemCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 17 }}>{row.customerName}</div>
                    <div style={subtleTextStyle}>
                      {row.service?.name} / {row.option?.durationMinutes} min / {row.quantity} motos / {row.pax} pax
                    </div>
                    <div style={subtleTextStyle}>
                      País {row.customerCountry} / Total {euros(row.totalPriceCents)}
                    </div>
                  </div>
                  <div style={codeBadgeStyle}>{row.boothCode ?? "Sin código"}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionTitle}>En camino</div>
            <div style={sectionSubtitle}>Agrupado por taxiboat para ver carga y prioridad.</div>
          </div>
          <div style={pillStyle}>{groups.length} viajes</div>
        </div>

        {enCamino.length === 0 ? (
          <div style={emptyStateStyle}>No hay nadie en camino ahora mismo.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {groups.map((group) => (
              <article key={group.key} style={groupCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      {boatLabel(group.boat)}
                      {group.tripNo ? ` / Viaje ${group.tripNo}` : ""}
                    </div>
                    <div style={subtleTextStyle}>
                      Salida {hhmm(group.departedAt)} / {group.items.length} reservas / {group.paxTotal} pax
                    </div>
                  </div>
                  <div style={tripBadgeStyle}>Activa</div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {group.items.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        ...itemCardStyle,
                        background:
                          row.id === lastMarkedId
                            ? "linear-gradient(180deg, #ecfccb 0%, #ffffff 100%)"
                            : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontWeight: 900, fontSize: 17 }}>{row.customerName}</div>
                          <div style={subtleTextStyle}>
                            {row.service?.name} / {row.option?.durationMinutes} min / {row.quantity} motos / {row.pax} pax
                          </div>
                          <div style={subtleTextStyle}>
                            País {row.customerCountry} / Total {euros(row.totalPriceCents)}
                          </div>
                        </div>
                        <div style={codeBadgeStyle}>{row.boothCode ?? "Sin código"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionTitle}>Recibidas</div>
            <div style={sectionSubtitle}>Control de entradas ya traspasadas a tienda.</div>
          </div>
          <div style={pillStyle}>{recibidas.length} cierres</div>
        </div>

        {recibidas.length === 0 ? (
          <div style={emptyStateStyle}>Todavía no se ha recibido ninguna reserva.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {recibidas.map((row) => (
              <article key={row.id} style={itemCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 17 }}>{row.customerName}</div>
                    <div style={subtleTextStyle}>
                      Recibido a las {hhmm(row.arrivedStoreAt)} / {row.service?.name}
                    </div>
                  </div>
                  <div style={codeBadgeStyle}>{row.boothCode ?? "Sin código"}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 16,
  padding: 18,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 21,
  fontWeight: 950,
  color: "#0f172a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const pillStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 999,
  padding: "7px 12px",
  background: "#f8fafc",
  fontWeight: 900,
  fontSize: 12,
  color: "#334155",
};

const groupCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 14,
};

const tripBadgeStyle: React.CSSProperties = {
  border: "1px solid #bae6fd",
  background: "#f0f9ff",
  color: "#0369a1",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 12,
  height: "fit-content",
};

const itemCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const codeBadgeStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 900,
  fontSize: 12,
  height: "fit-content",
};

const subtleTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  color: "#64748b",
  background: "#f8fafc",
};
