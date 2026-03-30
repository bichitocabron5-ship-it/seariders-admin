"use client";

import { eurFromCents, fmtHours, fmtNumber } from "@/lib/mechanics-format";

type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type EventRow = {
  id: string;
  type: MaintenanceEventType;
  hoursAtService: number;
  note: string | null;
  createdAt: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  laborCostCents: number | null;
  partsCostCents: number | null;
  costCents: number | null;
  faultCode: string | null;
  reopenCount: number;
  partUsages: Array<{
    id: string;
    qty: number;
    totalCostCents: number | null;
    sparePart: {
      name: string;
      sku: string;
      unit: string;
    } | null;
  }>;
};

type Props = {
  activeEvents: EventRow[];
  resolvedEvents: EventRow[];
  eventTypeLabel: Record<MaintenanceEventType, string>;
  onEdit: (eventId: string) => void;
  onReopen: (eventId: string) => void;
};

function hoursSince(dateIso: string | null | undefined) {
  if (!dateIso) return null;
  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

function formatOpenAge(dateIso: string | null | undefined) {
  const h = hoursSince(dateIso);
  if (h == null) return "—";
  if (h < 24) return `${fmtNumber(h, 1)} h`;
  return `${fmtNumber(h / 24, 1)} d`;
}

function eventPriorityLabel(params: {
  status: string;
  severity: string;
  createdAt: string | null | undefined;
}) {
  const ageHours = hoursSince(params.createdAt) ?? 0;
  if (params.severity === "CRITICAL") return "CRÍTICA";
  if (params.status === "OPEN" && params.severity === "HIGH") return "MUY ALTA";
  if (params.status === "OPEN" && ageHours >= 72) return "MUY ALTA";
  if (params.status === "IN_PROGRESS" && ageHours >= 120) return "ALTA";
  if (params.severity === "HIGH") return "ALTA";
  if (params.status === "EXTERNAL") return "MEDIA";
  if (ageHours >= 48) return "MEDIA";
  return "NORMAL";
}

function priorityBadgeStyle(priority: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (priority === "CRÍTICA") return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  if (priority === "MUY ALTA") return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  if (priority === "ALTA") return { ...base, borderColor: "#fed7aa", background: "#fff7ed", color: "#c2410c" };
  if (priority === "MEDIA") return { ...base, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
  return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function isEditableEventStatus(status: string) {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "EXTERNAL";
}

function EventCard({
  event,
  eventTypeLabel,
  onEdit,
  onReopen,
}: {
  event: EventRow;
  eventTypeLabel: Record<MaintenanceEventType, string>;
  onEdit: (eventId: string) => void;
  onReopen: (eventId: string) => void;
}) {
  const partsSummary = event.partUsages.reduce(
    (acc, p) => {
      acc.qty += Number(p.qty ?? 0);
      acc.cost += Number(p.totalCostCents ?? 0);
      return acc;
    },
    { qty: 0, cost: 0 }
  );

  const openAge = formatOpenAge(event.createdAt);
  const priority = eventPriorityLabel({
    status: event.status,
    severity: event.severity,
    createdAt: event.createdAt,
  });

  const realPartsCost = event.partUsages.reduce(
    (acc, p) => acc + Number(p.totalCostCents ?? 0),
    0
  );
  const totalKnownCost = Number(event.laborCostCents ?? 0) + realPartsCost;

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 12,
        background: "#fafafa",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 900 }}>
            {eventTypeLabel[event.type] ?? event.type}
            {typeof event.hoursAtService === "number" ? ` · ${fmtHours(event.hoursAtService)} h` : ""}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{fmtDateTime(event.createdAt)}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 900 }}>
            {event.status}
          </div>
          <div style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 900 }}>
            {event.severity}
          </div>
          <div style={priorityBadgeStyle(priority)}>{priority}</div>

          {isEditableEventStatus(event.status) ? (
            <button
              type="button"
              onClick={() => onEdit(event.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Editar / Resolver
            </button>
          ) : null}

          {event.status === "RESOLVED" ? (
            <button
              type="button"
              onClick={() => onReopen(event.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Reabrir
            </button>
          ) : null}
        </div>
      </div>

      {event.faultCode ? (
        <div style={{ fontSize: 13 }}>
          <b>Fault code:</b> {event.faultCode}
        </div>
      ) : null}

      {event.reopenCount > 0 ? (
        <div style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 900 }}>
          Reabierto {event.reopenCount}x
        </div>
      ) : null}

      {event.note ? <div style={{ fontSize: 13 }}>{event.note}</div> : null}

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Coste: <b>{eurFromCents(event.costCents)}</b>
        {event.laborCostCents != null ? ` · Mano de obra: ${eurFromCents(event.laborCostCents)}` : ""}
        {event.partsCostCents != null ? ` · Piezas: ${eurFromCents(event.partsCostCents)}` : ""}
      </div>

      {isEditableEventStatus(event.status) ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tiempo abierto</div>
            <div style={{ marginTop: 4, fontWeight: 900 }}>{openAge}</div>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Coste piezas real</div>
            <div style={{ marginTop: 4, fontWeight: 900 }}>{eurFromCents(realPartsCost)}</div>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fff" }}>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Coste conocido actual</div>
            <div style={{ marginTop: 4, fontWeight: 900 }}>{eurFromCents(totalKnownCost)}</div>
          </div>
        </div>
      ) : null}

      {event.partUsages.length ? (
        <div
          style={{
            marginTop: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 10,
            padding: 10,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900 }}>
            Recambios utilizados · {partsSummary.qty} uds · {eurFromCents(partsSummary.cost)}
          </div>

          {event.partUsages.map((p) => (
            <div
              key={p.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}
            >
              <div>
                {p.sparePart?.name ?? "Recambio eliminado"}
                {p.sparePart?.sku ? ` · ${p.sparePart.sku}` : ""}
                {p.sparePart?.unit ? ` · ${p.qty} ${p.sparePart.unit}` : ` · qty ${p.qty}`}
              </div>
              <div style={{ fontWeight: 700 }}>{eurFromCents(p.totalCostCents)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function MaintenanceEventsSection({
  activeEvents,
  resolvedEvents,
  eventTypeLabel,
  onEdit,
  onReopen,
}: Props) {
  return (
    <div
      style={{
        ...{
          border: "1px solid #dbe4ea",
          borderRadius: 20,
          background: "white",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
        },
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 22 }}>
            Eventos abiertos / en curso · {activeEvents.length}
          </div>

          {activeEvents.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No hay eventos abiertos, en curso o externos.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activeEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  eventTypeLabel={eventTypeLabel}
                  onEdit={onEdit}
                  onReopen={onReopen}
                />
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 22 }}>
            Histórico resuelto · {resolvedEvents.length}
          </div>

          {resolvedEvents.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No hay eventos resueltos o cancelados.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {resolvedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  eventTypeLabel={eventTypeLabel}
                  onEdit={onEdit}
                  onReopen={onReopen}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
