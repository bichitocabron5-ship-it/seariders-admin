"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type OperationCard = {
  id: string;
  customerName: string;
  customerCountry: string | null;
  companionsCount: number;
  serviceName: string | null;
  durationMinutes: number | null;
  channelName: string | null;
  source: string | null;
  boothCode: string | null;
  taxiboatTripId: string | null;
  taxiboatBoat: string | null;
  taxiboatTripNo: number | null;
  taxiboatDepartedAt: string | null;
  status: string | null;
  minsToStart: number | null;
  pendingCents: number;
  paidCents: number;
  formalizedAt: string | null;
  startingSoon: boolean;
  criticalPendingPayment: boolean;
  criticalContractsIncomplete: boolean;
  overdueOperation: boolean;
  waitingTooLong: boolean;
  missingAssignment: boolean;
  contractsBadge: {
    requiredUnits: number;
    readyCount: number;
  } | null;
  platformExtrasPendingCount: number;
  notes: string | null;
  scheduledTime: string | null;
  activityDate: string | null;
};

type SaturationItem = {
  serviceName: string | null;
  count: number;
  reservations: Array<{
    id: string;
    customerName: string;
    scheduledTime: string | null;
    status: string | null;
  }>;
};

export default function OperationsBoardSection({
  board,
  areas,
  saturation,
}: {
  board: {
    pending: OperationCard[];
    upcoming: OperationCard[];
    ready: OperationCard[];
    inSea: OperationCard[];
    completed: OperationCard[];
  };
  areas: {
    booth: {
      pendingArrivalToStore: OperationCard[];
      arrivedToStore: OperationCard[];
      taxiboatPendingDeparture: OperationCard[];
    };
    store: {
      unformalized: OperationCard[];
      pendingPayments: OperationCard[];
      incompleteContracts: OperationCard[];
    };
    platform: {
      ready: OperationCard[];
      inSea: OperationCard[];
      extrasPending: OperationCard[];
    };
  };
  saturation: SaturationItem[];
}) {
  return (
    <>
      <section style={sectionCard}>
        <div style={sectionHeaderRow}>
          <div>
            <div style={sectionEyebrow}>Board</div>
            <div style={sectionTitle}>Estado de reservas</div>
          </div>
        </div>

        <div style={boardGrid}>
          <BoardColumn title="Pendientes" rows={board.pending} styleExtra={{ background: "#fff9ee", borderColor: "#f7d58d" }} />
          <BoardColumn title="Próximas" rows={board.upcoming} />
          <BoardColumn title="Ready" rows={board.ready} styleExtra={{ background: "#f2f8ff", borderColor: "#cfe0ff" }} />
          <BoardColumn title="En mar" rows={board.inSea} styleExtra={{ background: "#eefcf7", borderColor: "#b8f1d7" }} />
          <BoardColumn title="Completadas" rows={board.completed} styleExtra={{ background: "#f7f7fb", borderColor: "#d9dee8" }} />
        </div>

        <div style={areaGrid}>
          <AreaBlock
            title="Booth"
            sections={[
              { title: "Pendientes de llegar a Store", rows: areas.booth.pendingArrivalToStore },
              { title: "Llegados a Store", rows: areas.booth.arrivedToStore },
              { title: "Taxiboat pendiente de salida", rows: areas.booth.taxiboatPendingDeparture },
            ]}
          />

          <AreaBlock
            title="Store"
            sections={[
              { title: "Sin formalizar", rows: areas.store.unformalized },
              { title: "Pendientes de cobro", rows: areas.store.pendingPayments },
              { title: "Contratos incompletos", rows: areas.store.incompleteContracts },
            ]}
          />

          <AreaBlock
            title="Platform"
            sections={[
              { title: "Ready", rows: areas.platform.ready },
              { title: "En mar", rows: areas.platform.inSea },
              { title: "Extras pendientes", rows: areas.platform.extrasPending },
            ]}
          />
        </div>
      </section>

      {saturation.length > 0 ? (
        <section style={saturationCard}>
          <div style={sectionHeaderRow}>
            <div>
              <div style={sectionEyebrow}>Capacidad</div>
              <div style={saturationTitle}>Saturación por servicio</div>
            </div>
          </div>

          <div style={saturationGrid}>
            {saturation.map((service, idx) => (
              <div key={`${service.serviceName ?? "service"}-${idx}`} style={saturationItemStyle}>
                <div style={{ fontWeight: 900 }}>
                  {service.serviceName ?? "Servicio"} | {service.count} reservas en la misma ventana
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 12, opacity: 0.88 }}>
                  {service.reservations.map((reservation) => (
                    <div key={reservation.id}>
                      <strong>{reservation.customerName}</strong>
                      {" | "}{fmtDateTime(reservation.scheduledTime)}
                      {" | "}{reservation.status ?? "-"}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function BoardColumn({
  title,
  rows,
  styleExtra,
}: {
  title: string;
  rows: OperationCard[];
  styleExtra?: CSSProperties;
}) {
  return (
    <div style={{ ...boardColumn, ...styleExtra }}>
      <div style={columnHeader}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>Reservas en esta fase</div>
        </div>
        <div style={countBadge}>{rows.length}</div>
      </div>

      {rows.length === 0 ? (
        <div style={emptyState}>Sin elementos.</div>
      ) : (
        rows.map((row) => <OperationItem key={row.id} row={row} />)
      )}
    </div>
  );
}

function AreaBlock({
  title,
  sections,
}: {
  title: string;
  sections: Array<{
    title: string;
    rows: OperationCard[];
  }>;
}) {
  return (
    <div style={areaCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950, fontSize: 22 }}>{title}</div>
      </div>

      {sections.map((section) => (
        <div key={section.title} style={{ display: "grid", gap: 10 }}>
          <div style={areaSectionHeader}>
            <span>{section.title}</span>
            <span style={countBadge}>{section.rows.length}</span>
          </div>

          {section.rows.length === 0 ? (
            <div style={emptyState}>Sin elementos.</div>
          ) : (
            section.rows.slice(0, 5).map((row) => (
              <OperationItem key={`${section.title}-${row.id}`} row={row} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function OperationItem({ row }: { row: OperationCard }) {
  const statusTone = row.overdueOperation || row.criticalPendingPayment || row.criticalContractsIncomplete
    ? criticalPill
    : row.startingSoon || row.waitingTooLong || row.missingAssignment
      ? warnPill
      : neutralPill;

  return (
    <div style={itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{row.customerName}</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            {row.serviceName ?? "Servicio"}
            {row.durationMinutes ? ` | ${row.durationMinutes} min` : ""}
            {row.channelName ? ` | ${row.channelName}` : ""}
          </div>
        </div>

        <div style={statusTone}>{row.status ?? "-"}</div>
      </div>

      <div style={metaGrid}>
        <Meta label="Hora" value={fmtDateTime(row.scheduledTime ?? row.activityDate)} />
        <Meta label="Pendiente" value={eur(row.pendingCents)} />
        <Meta label="Pagado" value={eur(row.paidCents)} />
        <Meta label="Origen" value={row.source ?? "-"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, max-content))", gap: 8 }}>
        {row.companionsCount ? <Tag>{`+${row.companionsCount} acompañantes`}</Tag> : null}
        {row.customerCountry ? <Tag>{row.customerCountry}</Tag> : null}
        {row.boothCode ? <Tag>{`Booth ${row.boothCode}`}</Tag> : null}
        {row.contractsBadge ? <Tag>{`Contratos ${row.contractsBadge.readyCount}/${row.contractsBadge.requiredUnits}`}</Tag> : null}
        {row.platformExtrasPendingCount > 0 ? <Tag tone="warn">{`Extras plataforma ${row.platformExtrasPendingCount}`}</Tag> : null}
      </div>

      {row.taxiboatTripId ? (
        <div style={subtlePanel}>
          Taxiboat: <strong>{row.taxiboatBoat ?? "-"}</strong>
          {row.taxiboatTripNo ? ` | viaje ${row.taxiboatTripNo}` : ""}
          {row.taxiboatDepartedAt ? ` | salido ${fmtDateTime(row.taxiboatDepartedAt)}` : ""}
        </div>
      ) : null}

      {!row.formalizedAt ? (
        <div style={warnBanner}>Pendiente de formalizar.</div>
      ) : null}

      {row.minsToStart !== null ? (
        <div style={{ fontSize: 12, opacity: 0.82 }}>
          {row.minsToStart >= 0 ? `Empieza en ${row.minsToStart} min` : `Retraso ${Math.abs(row.minsToStart)} min`}
        </div>
      ) : null}

      {row.notes ? <div style={{ fontSize: 12, opacity: 0.88 }}>{row.notes}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <a href={`/store/create?editFrom=${row.id}`} style={secondaryLinkSmall}>
          Abrir
        </a>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.56, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "warn" }) {
  return <span style={tone === "warn" ? tagWarn : tagNeutral}>{children}</span>;
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "-";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

const sectionCard: CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #d9dee8",
  background: "rgba(255, 255, 255, 0.92)",
  display: "grid",
  gap: 16,
  boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
};

const sectionHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#6c819d",
};

const sectionTitle: CSSProperties = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 950,
  color: "#142033",
};

const boardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  alignItems: "start",
};

const boardColumn: CSSProperties = {
  minWidth: 0,
  border: "1px solid #dde4ee",
  borderRadius: 20,
  padding: 14,
  display: "grid",
  gap: 12,
};

const columnHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const countBadge: CSSProperties = {
  minWidth: 32,
  height: 32,
  padding: "0 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20, 32, 51, 0.08)",
  fontWeight: 900,
  fontSize: 12,
  color: "#142033",
};

const itemCard: CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 16,
  padding: 14,
  background: "rgba(255,255,255,0.9)",
  display: "grid",
  gap: 10,
};

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
};

const subtlePanel: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fbff",
  fontSize: 12,
};

const warnBanner: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #f7d58d",
  background: "#fff8e8",
  color: "#8a5100",
  fontWeight: 900,
  fontSize: 12,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d7deea",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  color: "#6c819d",
  background: "rgba(255,255,255,0.45)",
};

const areaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
  alignItems: "start",
};

const areaCard: CSSProperties = {
  border: "1px solid #dde4ee",
  background: "#fff",
  borderRadius: 20,
  padding: 16,
  display: "grid",
  gap: 16,
};

const areaSectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  fontWeight: 900,
  fontSize: 15,
};

const saturationCard: CSSProperties = {
  ...sectionCard,
  border: "1px solid #f7d58d",
  background: "linear-gradient(180deg, #fff9ee 0%, #fff 100%)",
};

const saturationTitle: CSSProperties = {
  ...sectionTitle,
  color: "#8a5100",
};

const saturationGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const saturationItemStyle: CSSProperties = {
  border: "1px solid #f7d58d",
  background: "#fff",
  borderRadius: 16,
  padding: 12,
};

const neutralPill: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#36485f",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const warnPill: CSSProperties = {
  ...neutralPill,
  background: "#fff7ed",
  color: "#9a3412",
};

const criticalPill: CSSProperties = {
  ...neutralPill,
  background: "#fff1f2",
  color: "#be123c",
};

const tagNeutral: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #dde4ee",
  background: "#fff",
  fontSize: 11,
  fontWeight: 900,
  color: "#40536c",
};

const tagWarn: CSSProperties = {
  ...tagNeutral,
  borderColor: "#f7d58d",
  background: "#fff8e8",
  color: "#8a5100",
};

const secondaryLinkSmall: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "8px 10px",
  borderRadius: 10,
  fontSize: 12,
  textAlign: "center",
};
