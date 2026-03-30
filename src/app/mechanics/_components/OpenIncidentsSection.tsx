"use client";

import Link from "next/link";

type OpenIncidentRow = {
  id: string;
  entityType: "JETSKI" | "ASSET";
  type: "ACCIDENT" | "DAMAGE" | "MECHANICAL" | "OTHER";
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "LINKED" | "RESOLVED" | "CANCELED";
  description: string | null;
  affectsOperability: boolean;
  operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE" | null;
  retainDeposit: boolean;
  retainDepositCents: number | null;
  maintenanceEventId: string | null;
  createdAt: string;
  jetski: {
    id: string;
    number: number;
    model: string | null;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
    operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";
  } | null;
  asset: {
    id: string;
    name: string;
    code: string | null;
    type: string;
    plate: string | null;
    chassisNumber: string | null;
    maxPax: number | null;
    operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";
  } | null;
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

function incidentTypeLabel(type: OpenIncidentRow["type"]) {
  const map: Record<OpenIncidentRow["type"], string> = {
    ACCIDENT: "Accidente",
    DAMAGE: "Daño",
    MECHANICAL: "Mecánica",
    OTHER: "Otra",
  };

  return map[type];
}

function incidentLevelLabel(level: OpenIncidentRow["level"]) {
  const map: Record<OpenIncidentRow["level"], string> = {
    LOW: "Baja",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Crítica",
  };

  return map[level];
}

function incidentEntityLabel(row: OpenIncidentRow) {
  if (row.entityType === "JETSKI" && row.jetski) {
    return `Moto ${row.jetski.number}${row.jetski.plate ? ` · ${row.jetski.plate}` : ""}${row.jetski.chassisNumber ? ` · Bastidor ${row.jetski.chassisNumber}` : ""}`;
  }
  if (row.asset) {
    const base = row.asset.code ? `${row.asset.name} (${row.asset.code})` : row.asset.name;
    return `${base}${row.asset.plate ? ` · ${row.asset.plate}` : ""}${row.asset.chassisNumber ? ` · Bastidor ${row.asset.chassisNumber}` : ""}`;
  }
  return "Entidad";
}

export default function OpenIncidentsSection({
  openIncidents,
}: {
  openIncidents: OpenIncidentRow[];
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 22 }}>Incidencias abiertas</div>

      {openIncidents.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 16,
            padding: 14,
            opacity: 0.75,
          }}
        >
          No hay incidencias abiertas.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {openIncidents.map((incident) => {
            const href =
              incident.entityType === "JETSKI" && incident.jetski
                ? `/mechanics/jetski/${incident.jetski.id}`
                : incident.asset
                  ? `/mechanics/asset/${incident.asset.id}`
                  : "/mechanics";

            return (
              <div
                key={incident.id}
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
                      {incidentEntityLabel(incident)} · {incidentTypeLabel(incident.type)}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {fmtDateTime(incident.createdAt)}
                      {incident.affectsOperability ? " · Afecta operativa" : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                    <div style={severityBadgeStyle(incident.level)}>{incidentLevelLabel(incident.level)}</div>
                    <div style={operabilityBadgeStyle(incident.operabilityStatus)}>
                      {operabilityLabel(incident.operabilityStatus)}
                    </div>

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

                {incident.description ? <div style={{ fontSize: 13 }}>{incident.description}</div> : null}

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Estado incidencia: <b>{incident.status}</b>
                  {incident.retainDeposit ? ` · Retener fianza: ${eurFromCents(incident.retainDepositCents)}` : ""}
                  {incident.maintenanceEventId ? " · Evento técnico creado" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
