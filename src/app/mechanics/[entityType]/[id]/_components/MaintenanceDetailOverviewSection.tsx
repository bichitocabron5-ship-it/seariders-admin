"use client";

import { fmtHours, isNegativeNumber } from "@/lib/mechanics-format";
import { operabilityBadgeStyle, operabilityLabel } from "@/lib/operability-ui";

type MaintenanceEntityType = "JETSKI" | "ASSET";
type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";

type Props = {
  entityType: MaintenanceEntityType;
  entity: {
    displayName: string;
    type?: string;
    model?: string | null;
    year?: number | null;
    plate?: string | null;
    chassisNumber?: string | null;
    maxPax?: number | null;
    code?: string | null;
    currentHours?: number | null;
    operabilityStatus: string;
    status: string;
  };
  service: {
    state: ServiceState;
    hoursSinceService: number | null;
    serviceDueAt: number;
    hoursLeft: number | null;
  };
  lastServiceHoursEffective: number | null;
};

function stateBadgeStyle(state: ServiceState): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
  };

  if (state === "DUE") return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  if (state === "WARN") return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  if (state === "UNKNOWN") return { ...base, borderColor: "#d1d5db", background: "#f9fafb", color: "#374151" };
  return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
}

function stateLabel(state: ServiceState) {
  if (state === "DUE") return "DUE";
  if (state === "WARN") return "WARN";
  if (state === "UNKNOWN") return "UNKNOWN";
  return "OK";
}

function Kpi({
  title,
  value,
  danger,
}: {
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 26,
          fontWeight: 950,
          color: danger ? "#b91c1c" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function MaintenanceDetailOverviewSection({
  entityType,
  entity,
  service,
  lastServiceHoursEffective,
}: Props) {
  return (
    <>
      <div
        style={{
          border: "1px solid #dbe4ea",
          borderRadius: 20,
          background: "white",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>{entity.displayName}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {entityType === "JETSKI" ? "JETSKI" : entity.type}
              {entity.model ? ` · ${entity.model}` : ""}
              {entity.year ? ` · ${entity.year}` : ""}
              {entity.plate ? ` · ${entity.plate}` : ""}
              {entity.chassisNumber ? ` · Bastidor: ${entity.chassisNumber}` : ""}
              {entity.maxPax ? ` · Pax máx: ${entity.maxPax}` : ""}
              {entity.code ? ` · ${entity.code}` : ""}
            </div>
          </div>

          <div style={stateBadgeStyle(service.state)}>{stateLabel(service.state)}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>Estado operativo:</span>
          <span style={operabilityBadgeStyle(entity.operabilityStatus ?? entity.status)}>
            {operabilityLabel(entity.operabilityStatus ?? entity.status)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Horas actuales" value={fmtHours(entity.currentHours)} />
        <Kpi title="Desde última revisión" value={fmtHours(service.hoursSinceService)} />
        <Kpi title="Próxima revisión" value={fmtHours(service.serviceDueAt)} />
        <Kpi
          title="Horas restantes"
          value={fmtHours(service.hoursLeft)}
          danger={isNegativeNumber(service.hoursLeft)}
        />
        <Kpi title="Última revisión efectiva" value={fmtHours(lastServiceHoursEffective)} />
      </div>
    </>
  );
}
