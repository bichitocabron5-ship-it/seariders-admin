"use client";

import Link from "next/link";
import { fmtHours } from "@/lib/mechanics-format";

type MaintenanceEntityType = "JETSKI" | "ASSET";

type OpenEventRow = {
  id: string;
  entityType: MaintenanceEntityType;
  type: string;
  status: "OPEN" | "IN_PROGRESS" | "EXTERNAL";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  hoursAtService: number;
  note: string | null;
  supplierName: string | null;
  externalWorkshop: boolean;
  costCents: number | null;
  laborCostCents: number | null;
  partsCostCents: number | null;
  faultCode: string | null;
  reopenCount: number;
  jetski: {
    id: string;
    number: number;
    model: string | null;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
  } | null;
  asset: {
    id: string;
    name: string;
    code: string | null;
    type: string;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
  } | null;
  createdByUser: {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string | null;
  } | null;
  _count: {
    partUsages: number;
  };
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function eurFromCents(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value / 100).toFixed(2)} €`;
}

function eventStatusBadgeStyle(
  status: "OPEN" | "IN_PROGRESS" | "EXTERNAL"
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (status === "OPEN") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }

  if (status === "IN_PROGRESS") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }

  return { ...base, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
}

function severityBadgeStyle(
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (severity === "CRITICAL") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  if (severity === "HIGH") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (severity === "MEDIUM") {
    return { ...base, borderColor: "#fed7aa", background: "#fff7ed", color: "#c2410c" };
  }

  return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
}

function openEventEntityLabel(row: OpenEventRow) {
  if (row.entityType === "JETSKI" && row.jetski) {
    return `Moto ${row.jetski.number}${row.jetski.plate ? ` · ${row.jetski.plate}` : ""}${row.jetski.chassisNumber ? ` · Bastidor ${row.jetski.chassisNumber}` : ""}`;
  }
  if (row.asset) {
    const base = row.asset.code ? `${row.asset.name} (${row.asset.code})` : row.asset.name;
    return `${base}${row.asset.plate ? ` · ${row.asset.plate}` : ""}${row.asset.chassisNumber ? ` · Bastidor ${row.asset.chassisNumber}` : ""}`;
  }
  return "Entidad";
}

function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    SERVICE: "Servicio",
    OIL_CHANGE: "Cambio de aceite",
    REPAIR: "Reparación",
    INSPECTION: "Inspección",
    INCIDENT_REVIEW: "Revisión de incidencia",
    HOUR_ADJUSTMENT: "Ajuste de horas",
  };

  return map[type] ?? type;
}

function eventStatusLabel(status: OpenEventRow["status"]) {
  const map: Record<OpenEventRow["status"], string> = {
    OPEN: "Abierto",
    IN_PROGRESS: "En curso",
    EXTERNAL: "Externo",
  };

  return map[status];
}

function severityLabel(severity: OpenEventRow["severity"]) {
  const map: Record<OpenEventRow["severity"], string> = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Crítica",
  };

  return map[severity];
}

export default function ActiveEventsSection({
  openEvents,
  onEdit,
}: {
  openEvents: OpenEventRow[];
  onEdit: (eventId: string) => void;
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 22 }}>Eventos activos</div>

      {openEvents.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 16,
            padding: 14,
            opacity: 0.75,
          }}
        >
          No hay eventos abiertos, en curso o externos.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {openEvents.map((event) => {
            const href =
              event.entityType === "JETSKI" && event.jetski
                ? `/mechanics/jetski/${event.jetski.id}`
                : event.asset
                  ? `/mechanics/asset/${event.asset.id}`
                  : "/mechanics";

            return (
              <div
                key={event.id}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 950 }}>
                      {openEventEntityLabel(event)} · {eventTypeLabel(event.type)}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {fmtDateTime(event.createdAt)}
                      {event.faultCode ? ` · Código de avería: ${event.faultCode}` : ""}
                      {typeof event.hoursAtService === "number" ? ` · ${fmtHours(event.hoursAtService)} h` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                    <div style={eventStatusBadgeStyle(event.status)}>{eventStatusLabel(event.status)}</div>
                    <div style={severityBadgeStyle(event.severity)}>{severityLabel(event.severity)}</div>

                    <button
                      type="button"
                      onClick={() => onEdit(event.id)}
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#111",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "6px 8px",
                        background: "#fff",
                      }}
                    >
                      Editar / Resolver
                    </button>

                    <Link
                      href={href}
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        textDecoration: "none",
                        color: "#111",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "6px 8px",
                        background: "#fff",
                      }}
                    >
                      Abrir ficha
                    </Link>
                  </div>
                </div>

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Coste: <b>{eurFromCents(event.costCents)}</b>
                  {event.laborCostCents != null ? ` · Mano de obra: ${eurFromCents(event.laborCostCents)}` : ""}
                  {event.partsCostCents != null ? ` · Piezas: ${eurFromCents(event.partsCostCents)}` : ""}
                  {event._count?.partUsages ? ` · Recambios usados: ${event._count.partUsages}` : ""}
                </div>

                {event.supplierName || event.externalWorkshop ? (
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    {event.supplierName ? `Proveedor/taller: ${event.supplierName}` : ""}
                    {event.externalWorkshop ? " · Taller externo" : ""}
                  </div>
                ) : null}

                {event.reopenCount > 0 ? (
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Reabierto: <b>{event.reopenCount}</b> vez/veces
                  </div>
                ) : null}

                {event.note ? <div style={{ fontSize: 13 }}>{event.note}</div> : null}

                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Creado por:{" "}
                  <b>
                    {event.createdByUser?.fullName ||
                      event.createdByUser?.username ||
                      event.createdByUser?.email ||
                      "—"}
                  </b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
