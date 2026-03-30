"use client";

import Link from "next/link";
import { fmtHours, isNegativeNumber } from "@/lib/mechanics-format";

type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";
type MaintenanceEntityType = "JETSKI" | "ASSET";
type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type ResourceCardRow = {
  id: string;
  entityType: MaintenanceEntityType;
  title: string;
  href: string;
  summary: string;
  operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";
  currentHours: number | null;
  service: {
    state: ServiceState;
    hoursSinceService: number | null;
    serviceDueAt: number;
    hoursLeft: number | null;
  };
  lastServiceEventType: MaintenanceEventType | null;
  lastServiceEventAt: string | null;
};

function stateCardStyle(state: ServiceState): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  };

  if (state === "DUE") {
    return { ...base, border: "1px solid #fecaca", background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)" };
  }
  if (state === "WARN") {
    return { ...base, border: "1px solid #fde68a", background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" };
  }
  if (state === "UNKNOWN") {
    return { ...base, border: "1px solid #d0d9e4", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" };
  }

  return { ...base, border: "1px solid #dbe4ea", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" };
}

function operabilityLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    OPERATIONAL: "Operativa",
    MAINTENANCE: "Mantenimiento",
    DAMAGED: "Dañada",
    OUT_OF_SERVICE: "Fuera de servicio",
  };

  if (!value) return "—";
  return map[value] ?? value;
}

function operabilityBadgeStyle(
  value: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE" | null | undefined
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (value === "OUT_OF_SERVICE") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  if (value === "DAMAGED") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (value === "MAINTENANCE") {
    return { ...base, borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" };
  }

  return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
}

const EVENT_TYPE_LABEL: Record<MaintenanceEventType, string> = {
  SERVICE: "Servicio",
  OIL_CHANGE: "Cambio de aceite",
  REPAIR: "Reparación",
  INSPECTION: "Inspección",
  INCIDENT_REVIEW: "Revisión de incidencia",
  HOUR_ADJUSTMENT: "Ajuste de horas",
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

function lastEventSummary(type: MaintenanceEventType | null, at: string | null) {
  if (!type && !at) return "—";
  const label = type ? EVENT_TYPE_LABEL[type] : "Evento";
  const when = fmtDateTime(at);
  return `${label} · ${when}`;
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: number | string | null | undefined;
  strong?: boolean;
}) {
  const negative = isNegativeNumber(value);

  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontWeight: strong || negative ? 950 : 800,
          color: negative ? "#b91c1c" : "#111",
        }}
      >
        {fmtHours(value)}
      </div>
    </div>
  );
}

export default function MaintenanceResourcesSection({
  title,
  rows,
  onQuickAdjust,
  onOpenAdjust,
}: {
  title: string;
  rows: ResourceCardRow[];
  onQuickAdjust: (entityType: MaintenanceEntityType, entityId: string, currentHours: number | null, delta: number) => void;
  onOpenAdjust: (entityType: MaintenanceEntityType, entityId: string) => void;
}) {
  return (
    <section>
      <div style={{ fontWeight: 950, fontSize: 22, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        {rows.map((row) => (
          <div key={row.id} style={stateCardStyle(row.service.state)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{row.title}</div>

              <Link
                href={row.href}
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  textDecoration: "none",
                  color: "#111",
                  border: "1px solid #d0d9e4",
                  borderRadius: 10,
                  padding: "6px 8px",
                  background: "#fff",
                }}
              >
                Ver ficha
              </Link>
            </div>

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Estado operativo: <b>{row.operabilityStatus ?? "OPERATIONAL"}</b>
            </div>

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{row.summary}</div>

            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={operabilityBadgeStyle(row.operabilityStatus)}>
                {operabilityLabel(row.operabilityStatus)}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <Metric label="Horas actuales" value={row.currentHours} />
              <Metric label="Horas desde última revisión" value={row.service.hoursSinceService} />
              <Metric label="Próxima revisión" value={row.service.serviceDueAt} />
              <Metric
                label="Horas restantes"
                value={row.service.hoursLeft}
                strong={row.service.state === "WARN" || row.service.state === "DUE"}
              />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>
              Última revisión registrada: <b>{lastEventSummary(row.lastServiceEventType, row.lastServiceEventAt)}</b>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => onQuickAdjust(row.entityType, row.id, row.currentHours, 1)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                >
                  +1h
                </button>
                <button
                  onClick={() => onQuickAdjust(row.entityType, row.id, row.currentHours, 5)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                >
                  +5h
                </button>
                <button
                  onClick={() => onOpenAdjust(row.entityType, row.id)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                >
                  Ajustar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
