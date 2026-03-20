// src/app/mechanics/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtHours, isNegativeNumber } from "@/lib/mechanics-format";
import EditMaintenanceEventModal from "./_components/EditMaintenanceEventModal";

type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";
type MaintenanceEntityType = "JETSKI" | "ASSET";
type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type ServiceCalc = {
  state: ServiceState;
  hoursSinceService: number | null;
  serviceDueAt: number;
  hoursLeft: number | null;
};

type OverviewJetskiRow = {
  operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";
  id: string;
  number: number;
  plate: string | null;
  chassisNumber: string | null;
  model: string | null;
  year: number | null;
  maxPax: number | null;
  status: string;
  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;
  lastServiceEventAt: string | null;
  lastServiceEventType: MaintenanceEventType | null;
  lastServiceHoursEffective: number | null;
  service: ServiceCalc;
};

type OverviewAssetRow = {
  operabilityStatus: "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";
  id: string;
  type: string;
  name: string;
  plate: string | null;
  chassisNumber: string | null;
  model: string | null;
  year: number | null;
  maxPax: number | null;
  status: string;
  isMotorized: boolean;
  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;
  lastServiceEventAt: string | null;
  lastServiceEventType: MaintenanceEventType | null;
  lastServiceHoursEffective: number | null;
  service: ServiceCalc;
};

type OverviewResponse = {
  ok: true;
  only: "warn_due" | null;
  jetskis: OverviewJetskiRow[];
  assets: OverviewAssetRow[];
};

type OpenEventRow = {
  id: string;
  entityType: "JETSKI" | "ASSET";
  type: string;
  status: "OPEN" | "IN_PROGRESS" | "EXTERNAL";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  resolvedAt: string | null;
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
    return {
      ...base,
      borderColor: "#fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      ...base,
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  return {
    ...base,
    borderColor: "#bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
  };
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
    return {
      ...base,
      borderColor: "#fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
    };
  }

  if (severity === "HIGH") {
    return {
      ...base,
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  if (severity === "MEDIUM") {
    return {
      ...base,
      borderColor: "#fed7aa",
      background: "#fff7ed",
      color: "#c2410c",
    };
  }

  return {
    ...base,
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
  };
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

const EVENT_TYPE_LABEL: Record<MaintenanceEventType, string> = {
  SERVICE: "Servicio",
  OIL_CHANGE: "Cambio de aceite",
  REPAIR: "Reparación",
  INSPECTION: "Inspección",
  INCIDENT_REVIEW: "Revisión de incidencia",
  HOUR_ADJUSTMENT: "Ajuste de horas",
};

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

function stateCardStyle(state: ServiceState): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  };

  if (state === "DUE") {
    return {
      ...base,
      border: "1px solid #fecaca",
      background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)",
    };
  }
  if (state === "WARN") {
    return {
      ...base,
      border: "1px solid #fde68a",
      background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
    };
  }
  if (state === "UNKNOWN") {
    return {
      ...base,
      border: "1px solid #d0d9e4",
      background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
    };
  }
  return {
    ...base,
    border: "1px solid #dbe4ea",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  };
}

const pageShell: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  padding: 28,
  fontFamily: "system-ui",
  display: "grid",
  gap: 18,
};

const softCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "white",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

export default function MechanicsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [onlyWarnDue, setOnlyWarnDue] = useState(false);
  const [q, setQ] = useState("");

  const [jetskis, setJetskis] = useState<OverviewJetskiRow[]>([]);
  const [assets, setAssets] = useState<OverviewAssetRow[]>([]);
  const [openEvents, setOpenEvents] = useState<OpenEventRow[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [openIncidents, setOpenIncidents] = useState<OpenIncidentRow[]>([]);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorEntityType, setSelectorEntityType] =
    useState<MaintenanceEntityType>("JETSKI");
  const [selectorEntityId, setSelectorEntityId] = useState("");
  const [selectorEventType, setSelectorEventType] =
    useState<MaintenanceEventType>("SERVICE");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const url = onlyWarnDue ? "/api/mechanics/overview?only=warn_due" : "/api/mechanics/overview";
      const [overviewRes, openEventsRes, openIncidentsRes] = await Promise.all([
        fetch(url, { cache: "no-store" }),
        fetch("/api/mechanics/events/open?limit=50", { cache: "no-store" }),
        fetch("/api/platform/incidents/open", { cache: "no-store" }),
      ]);

      if (!overviewRes.ok) throw new Error(await overviewRes.text());
      if (!openEventsRes.ok) throw new Error(await openEventsRes.text());
      if (!openIncidentsRes.ok) throw new Error(await openIncidentsRes.text());

      const data = (await overviewRes.json()) as OverviewResponse;
      const openEventsJson = await openEventsRes.json();
      const openIncidentsJson = await openIncidentsRes.json();
      setJetskis(data.jetskis ?? []);
      setAssets(data.assets ?? []);
      setOpenEvents(openEventsJson.rows ?? []);
      setOpenIncidents(openIncidentsJson.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [onlyWarnDue]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredJetskis = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return jetskis;
    return jetskis.filter((j) => {
      const s = `moto ${j.number} ${j.plate ?? ""} ${j.chassisNumber ?? ""} ${j.model ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [jetskis, q]);

  const filteredAssets = useMemo(() => {
    const base = assets.filter((a) =>
    ["BOAT", "TOWBOAT", "JETCAR"].includes(a.type)
    );

    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter((a) => {
      const s = `${a.type} ${a.name} ${a.plate ?? ""} ${a.chassisNumber ?? ""} ${a.model ?? ""}`.toLowerCase();
      return s.includes(qq);
    });
  }, [assets, q]);

  function servicePriority(state: ServiceState) {
    if (state === "DUE") return 0;
    if (state === "WARN") return 1;
    if (state === "UNKNOWN") return 2;
    return 3;
  }

  const dueJetskis = filteredJetskis.filter((j) => j.service.state === "DUE");
  const warnJetskis = filteredJetskis.filter((j) => j.service.state === "WARN");
  const dueAssets = filteredAssets.filter((a) => a.service.state === "DUE");
  const warnAssets = filteredAssets.filter((a) => a.service.state === "WARN");

  const urgentCount = dueJetskis.length + dueAssets.length;
  const warnCount = warnJetskis.length + warnAssets.length;

  const orderedJetskis = [...filteredJetskis].sort(
    (a, b) => servicePriority(a.service.state) - servicePriority(b.service.state) || a.number - b.number
  );

  const orderedAssets = [...filteredAssets].sort(
    (a, b) =>
      servicePriority(a.service.state) - servicePriority(b.service.state) ||
      a.name.localeCompare(b.name, "es")
  );

  const openEventsCount = openEvents.filter((e) => e.status === "OPEN").length;
  const inProgressEventsCount = openEvents.filter((e) => e.status === "IN_PROGRESS").length;
  const externalEventsCount = openEvents.filter((e) => e.status === "EXTERNAL").length;
    
  function buildDetailHref(
    type: MaintenanceEntityType,
    id: string,
    eventType: MaintenanceEventType = "SERVICE"
  ) {
    const entitySegment = type === "JETSKI" ? "jetski" : "asset";
    return `/mechanics/${entitySegment}/${id}?new=1&type=${eventType}`;
  }

  function openSelector(
    type: MaintenanceEntityType = "JETSKI",
    eventType: MaintenanceEventType = "SERVICE",
    entityId = ""
  ) {
    setSelectorEntityType(type);
    setSelectorEntityId(entityId);
    setSelectorEventType(eventType);
    setSelectorOpen(true);
  }

  async function quickAdjust(entityType: MaintenanceEntityType, entityId: string, currentHours: number | null, delta: number) {
    try {
      if (currentHours === null || currentHours === undefined) {
        throw new Error("No hay horas actuales para este recurso.");
      }

      const res = await fetch("/api/mechanics/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          type: "HOUR_ADJUSTMENT",
          hoursAtService: currentHours + delta,
          note: `Ajuste rápido +${delta}h`,
          applyToEntity: true,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "No se pudo ajustar horas.");
      }

      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error ajustando horas");
    }
  }

  function lastEventSummary(type: MaintenanceEventType | null, at: string | null) {
    if (!type && !at) return "—";
    const label = type ? EVENT_TYPE_LABEL[type] : "Evento";
    const when = fmtDateTime(at);
    return `${label} · ${when}`;
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
      return {
        ...base,
        borderColor: "#fecaca",
        background: "#fff1f2",
        color: "#b91c1c",
      };
    }

    if (value === "DAMAGED") {
      return {
        ...base,
        borderColor: "#fde68a",
        background: "#fffbeb",
        color: "#92400e",
      };
    }

    if (value === "MAINTENANCE") {
      return {
        ...base,
        borderColor: "#bfdbfe",
        background: "#eff6ff",
        color: "#1d4ed8",
      };
    }

    return {
      ...base,
      borderColor: "#bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
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

  function incidentLevelBadgeStyle(level: OpenIncidentRow["level"]): React.CSSProperties {
    return severityBadgeStyle(level);
  }

  return (
    <div style={pageShell}>
      <div
        style={{
          ...softCard,
          background:
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 24%), linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
          padding: 20,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0369a1" }}>
            Mechanics
          </div>
          <div style={{ fontWeight: 950, fontSize: 34, lineHeight: 1.02, color: "#0f172a" }}>Operativa y mantenimiento</div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            Flota tecnica, revisiones, incidencias abiertas y accesos directos a ficha y recambios en una sola vista.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={heroPill}>Urgentes: {urgentCount}</span>
            <span style={heroPill}>Avisos: {warnCount}</span>
            <span style={heroPill}>Eventos abiertos: {openEventsCount}</span>
            <span style={heroPill}>En curso: {inProgressEventsCount}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (moto, matrícula, bastidor, modelo, recurso...)"
            style={{ padding: 10, borderRadius: 12, border: "1px solid #d0d9e4", width: 380 }}
          />

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={onlyWarnDue}
              onChange={(e) => setOnlyWarnDue(e.target.checked)}
            />
            Solo WARN/DUE
          </label>

          <button
            onClick={() => load()}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 950 }}
          >
            Refrescar
          </button>
          <Link
            href="/platform"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d0d9e4",
              background: "#fff",
              fontWeight: 950,
              textDecoration: "none",
              color: "#111",
            }}
          >
            Platform
          </Link>
          <Link
            href="/mechanics/parts"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d0d9e4",
              background: "#fff",
              fontWeight: 950,
              textDecoration: "none",
              color: "#111",
            }}
          >
            Recambios
          </Link>

          <button
            onClick={() => openSelector()}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 950 }}
          >
            Crear evento guiado
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>
          {error}
          </div>
       ) : null}

      {loading ? (
        <div style={{ opacity: 0.75 }}>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {(dueJetskis.length || dueAssets.length || warnJetskis.length || warnAssets.length) ? (
                    <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
                      <div style={{ fontWeight: 950, fontSize: 22 }}>Alertas de mecánica</div>

                      {(dueJetskis.length || dueAssets.length) ? (
                        <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
                          <div style={{ fontWeight: 950, color: "#b91c1c", marginBottom: 8 }}>DUE · Revisión vencida</div>
                          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                            {dueJetskis.map((j) => (
                          <div key={j.id}>
                            Moto {j.number} · horas actuales: <b>{fmtHours(j.currentHours)}</b> · próxima revisión: <b>{fmtHours(j.service.serviceDueAt)}</b>
                          </div>
                        ))}
                        {dueAssets.map((a) => (
                          <div key={a.id}>
                            {a.name} · horas actuales: <b>{fmtHours(a.currentHours)}</b> · próxima revisión: <b>{fmtHours(a.service.serviceDueAt)}</b>
                          </div>
                        ))}
                          </div>
                        </div>
                      ) : null}

                      {(warnJetskis.length || warnAssets.length) ? (
                        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
                          <div style={{ fontWeight: 950, color: "#92400e", marginBottom: 8 }}>WARN · próximas revisiones</div>
                          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                            {warnJetskis.map((j) => (
                          <div key={j.id}>
                            Moto {j.number} · restan:{" "}
                            <b style={{ color: isNegativeNumber(j.service.hoursLeft) ? "#b91c1c" : undefined }}>
                              {fmtHours(j.service.hoursLeft)}
                            </b>{" "}
                            horas
                          </div>
                        ))}
                        {warnAssets.map((a) => (
                          <div key={a.id}>
                            {a.name} · restan:{" "}
                            <b style={{ color: isNegativeNumber(a.service.hoursLeft) ? "#b91c1c" : undefined }}>
                              {fmtHours(a.service.hoursLeft)}
                            </b>{" "}
                            horas
                          </div>
                        ))}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                <section>
                  <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>DUE · revisión vencida</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#7f1d1d" }}>{urgentCount}</div>
                </div>

                <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>WARN · próximas revisiones</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#78350f" }}>{warnCount}</div>
                </div>

                <div style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Total jetskis</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>{filteredJetskis.length}</div>
                </div>

                <div style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Recursos motorizados</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950 }}>{filteredAssets.length}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>Eventos abiertos</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#7f1d1d" }}>
                    {openEventsCount}
                  </div>
                </div>

                <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>Eventos en curso</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#78350f" }}>
                    {inProgressEventsCount}
                  </div>
                </div>

                <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>Eventos externos</div>
                  <div style={{ marginTop: 4, fontSize: 26, fontWeight: 950, color: "#1e3a8a" }}>
                    {externalEventsCount}
                  </div>
                </div>
              </div>

              {(urgentCount > 0 || warnCount > 0) ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {urgentCount > 0 ? (
                    <div style={{ border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 16, padding: 14 }}>
                      <div style={{ fontWeight: 950, color: "#b91c1c", marginBottom: 8 }}>Atención inmediata</div>
                      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        {dueJetskis.map((j) => (
                      <div key={j.id}>
                        Moto {j.number} · actuales <b>{fmtHours(j.currentHours)}</b> · revisión <b>{fmtHours(j.service.serviceDueAt)}</b>
                      </div>
                    ))}
                    {dueAssets.map((a) => (
                      <div key={a.id}>
                        {a.name} · actuales <b>{fmtHours(a.currentHours)}</b> · revisión <b>{fmtHours(a.service.serviceDueAt)}</b>
                      </div>
                    ))}
                      </div>
                    </div>
                  ) : null}

                  {warnCount > 0 ? (
                    <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 14 }}>
                      <div style={{ fontWeight: 950, color: "#92400e", marginBottom: 8 }}>Próximas revisiones</div>
                      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        {warnJetskis.map((j) => (
                      <div key={j.id}>
                        Moto {j.number} · restan{" "}
                        <b style={{ color: isNegativeNumber(j.service.hoursLeft) ? "#b91c1c" : undefined }}>
                          {fmtHours(j.service.hoursLeft)}
                        </b>{" "}
                        h
                      </div>
                    ))}
                    {warnAssets.map((a) => (
                      <div key={a.id}>
                        {a.name} · restan{" "}
                        <b style={{ color: isNegativeNumber(a.service.hoursLeft) ? "#b91c1c" : undefined }}>
                          {fmtHours(a.service.hoursLeft)}
                        </b>{" "}
                        h
                      </div>
                    ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
      
            <section style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 22 }}>Incidencias desde Plataforma</div>

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
                  No hay incidencias abiertas o vinculadas desde Plataforma.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {openIncidents.map((inc) => {
                    const href =
                      inc.entityType === "JETSKI" && inc.jetski
                        ? `/mechanics/jetski/${inc.jetski.id}`
                        : inc.asset
                          ? `/mechanics/asset/${inc.asset.id}`
                          : "/mechanics";

                    const entityLabel =
                      inc.entityType === "JETSKI" && inc.jetski
                        ? `Moto ${inc.jetski.number}`
                        : inc.asset
                          ? inc.asset.code
                            ? `${inc.asset.name} (${inc.asset.code})`
                            : inc.asset.name
                          : "Entidad";

                    return (
                      <div
                        key={inc.id}
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
                              {entityLabel} · {incidentTypeLabel(inc.type)}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                              {fmtDateTime(inc.createdAt)}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                            <div style={incidentLevelBadgeStyle(inc.level)}>
                              {incidentLevelLabel(inc.level)}
                            </div>

                            <div style={operabilityBadgeStyle(inc.operabilityStatus)}>
                              {operabilityLabel(inc.operabilityStatus)}
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

                        {inc.description ? (
                          <div style={{ fontSize: 13 }}>{inc.description}</div>
                        ) : null}

                        <div style={{ fontSize: 13, opacity: 0.85 }}>
                          Estado incidencia: <b>{inc.status}</b>
                          {inc.retainDeposit ? ` · Retener fianza: ${eurFromCents(inc.retainDepositCents)}` : ""}
                          {inc.maintenanceEventId ? " · Evento técnico creado" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

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
                  {openEvents.map((ev) => {
                    const href =
                      ev.entityType === "JETSKI" && ev.jetski
                        ? `/mechanics/jetski/${ev.jetski.id}`
                        : ev.asset
                          ? `/mechanics/asset/${ev.asset.id}`
                          : "/mechanics";

                    return (
                      <div
                        key={ev.id}
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
                              {openEventEntityLabel(ev)} · {eventTypeLabel(ev.type)}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                              {fmtDateTime(ev.createdAt)}
                              {ev.faultCode ? ` · Código de avería: ${ev.faultCode}` : ""}
                              {typeof ev.hoursAtService === "number" ? ` · ${fmtHours(ev.hoursAtService)} h` : ""}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                            <div style={eventStatusBadgeStyle(ev.status)}>{eventStatusLabel(ev.status)}</div>
                            <div style={severityBadgeStyle(ev.severity)}>{severityLabel(ev.severity)}</div>

                            <button
                              type="button"
                              onClick={() => setEditingEventId(ev.id)}
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
                          Coste: <b>{eurFromCents(ev.costCents)}</b>
                          {ev.laborCostCents != null ? ` · Mano de obra: ${eurFromCents(ev.laborCostCents)}` : ""}
                          {ev.partsCostCents != null ? ` · Piezas: ${eurFromCents(ev.partsCostCents)}` : ""}
                          {ev._count?.partUsages ? ` · Recambios usados: ${ev._count.partUsages}` : ""}
                        </div>

                        {ev.supplierName || ev.externalWorkshop ? (
                          <div style={{ fontSize: 13, opacity: 0.85 }}>
                            {ev.supplierName ? `Proveedor/taller: ${ev.supplierName}` : ""}
                            {ev.externalWorkshop ? " · Taller externo" : ""}
                          </div>
                        ) : null}

                        {ev.reopenCount > 0 ? (
                          <div style={{ fontSize: 13, opacity: 0.85 }}>
                            Reabierto: <b>{ev.reopenCount}</b> vez/veces
                          </div>
                        ) : null}

                        {ev.note ? (
                          <div style={{ fontSize: 13 }}>{ev.note}</div>
                        ) : null}

                        <div style={{ fontSize: 12, opacity: 0.72 }}>
                          Creado por:{" "}
                          <b>
                            {ev.createdByUser?.fullName ||
                              ev.createdByUser?.username ||
                              ev.createdByUser?.email ||
                              "—"}
                          </b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div style={{ fontWeight: 950, fontSize: 22, marginBottom: 10 }}>Jetskis</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
              {orderedJetskis.map((j) => (
                <div key={j.id} style={stateCardStyle(j.service.state)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      Moto {j.number}
                    </div>

                    <Link
                      href={`/mechanics/jetski/${j.id}`}
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
                    Estado operativo: <b>{j.operabilityStatus ?? "OPERATIONAL"}</b>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    {j.model ? j.model : "—"} {j.year ? `· ${j.year}` : ""} {j.plate ? `· ${j.plate}` : ""}{j.chassisNumber ? ` · Bastidor: ${j.chassisNumber}` : ""}{j.maxPax ? ` · Pax máx: ${j.maxPax}` : ""}
                  </div>

                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={operabilityBadgeStyle(j.operabilityStatus)}>
                      {operabilityLabel(j.operabilityStatus)}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                    <Metric label="Horas actuales" value={j.currentHours} />
                    <Metric label="Horas desde última revisión" value={j.service.hoursSinceService} />
                    <Metric label="Próxima revisión" value={j.service.serviceDueAt} />
                    <Metric
                      label="Horas restantes"
                      value={j.service.hoursLeft}
                      strong={j.service.state === "WARN" || j.service.state === "DUE"}
                    />
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>
                    Última revisión registrada: <b>{lastEventSummary(j.lastServiceEventType, j.lastServiceEventAt)}</b>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => quickAdjust("JETSKI", j.id, j.currentHours, 1)}
                        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                      >
                        +1h
                      </button>
                      <button
                        onClick={() => quickAdjust("JETSKI", j.id, j.currentHours, 5)}
                        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                      >
                        +5h
                      </button>
                      <button
                        onClick={() => {
                          router.push(
                            buildDetailHref("JETSKI", j.id, "HOUR_ADJUSTMENT")
                          );
                        }}
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

          <section>
            <div style={{ fontWeight: 950, fontSize: 22, marginBottom: 10 }}>Recursos motorizados</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
              {orderedAssets.map((a) => (
                <div key={a.id} style={stateCardStyle(a.service.state)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      {a.name}
                    </div>

                    <Link
                      href={`/mechanics/asset/${a.id}`}
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
                    {a.type} {a.model ? `· ${a.model}` : ""} {a.year ? `· ${a.year}` : ""} {a.plate ? `· ${a.plate}` : ""}{a.chassisNumber ? ` · Bastidor: ${a.chassisNumber}` : ""}{a.maxPax ? ` · Pax máx: ${a.maxPax}` : ""}
                  </div>

                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={operabilityBadgeStyle(a.operabilityStatus)}>
                      {operabilityLabel(a.operabilityStatus)}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                    <Metric label="Horas actuales" value={a.currentHours} />
                    <Metric label="Horas desde última revisión" value={a.service.hoursSinceService} />
                    <Metric label="Próxima revisión" value={a.service.serviceDueAt} />
                    <Metric
                      label="Horas restantes"
                      value={a.service.hoursLeft}
                      strong={a.service.state === "WARN" || a.service.state === "DUE"}
                    />
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>
                    Última revisión registrada: <b>{lastEventSummary(a.lastServiceEventType, a.lastServiceEventAt)}</b>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => quickAdjust("ASSET", a.id, a.currentHours, 1)}
                        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                      >
                        +1h
                      </button>
                      <button
                        onClick={() => quickAdjust("ASSET", a.id, a.currentHours, 5)}
                        style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}
                      >
                        +5h
                      </button>
                      <button
                        onClick={() => {
                          router.push(
                            buildDetailHref("ASSET", a.id, "HOUR_ADJUSTMENT")
                          );
                        }}
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
        </div>
      )}

      {selectorOpen ? (
        <div
          onClick={() => setSelectorOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              borderRadius: 18,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid #dbe4ea",
              padding: 14,
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Seleccionar recurso</div>
              <button
                onClick={() => setSelectorOpen(false)}
                style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 12, padding: "8px 10px", fontWeight: 900 }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Tipo de entidad
                <select
                  value={selectorEntityType}
                  onChange={(e) => {
                    const t = e.target.value as MaintenanceEntityType;
                    setSelectorEntityType(t);
                    setSelectorEntityId("");
                  }}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
                >
                  <option value="JETSKI">Jetski</option>
                  <option value="ASSET">Asset motorizado</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Recurso
                {selectorEntityType === "JETSKI" ? (
                  <select
                    value={selectorEntityId}
                    onChange={(e) => setSelectorEntityId(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
                  >
                    <option value="">Selecciona jetski...</option>
                    {jetskis.map((j) => (
                      <option key={j.id} value={j.id}>
                        Moto {j.number}{j.plate ? ` · ${j.plate}` : ""}{j.chassisNumber ? ` · Bastidor ${j.chassisNumber}` : ""}{j.model ? ` · ${j.model}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectorEntityId}
                    onChange={(e) => setSelectorEntityId(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
                  >
                    <option value="">Selecciona asset...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.type}{a.plate ? ` · ${a.plate}` : ""}{a.chassisNumber ? ` · Bastidor ${a.chassisNumber}` : ""}{a.model ? ` · ${a.model}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Tipo de evento
                <select
                  value={selectorEventType}
                  onChange={(e) =>
                    setSelectorEventType(e.target.value as MaintenanceEventType)
                  }
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
                >
                  {Object.entries(EVENT_TYPE_LABEL).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #d0d9e4",
                  background: "#f9fafb",
                  fontSize: 13,
                  opacity: 0.85,
                }}
              >
                El formulario completo de evento se abrirá en la ficha técnica del recurso seleccionado.
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  if (!selectorEntityId) return;
                  router.push(
                    buildDetailHref(
                      selectorEntityType,
                      selectorEntityId,
                      selectorEventType
                    )
                  );
                  setSelectorOpen(false);
                }}
                disabled={!selectorEntityId}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: !selectorEntityId ? "#9ca3af" : "#111",
                  color: "#fff",
                  fontWeight: 950,
                }}
              >
                Abrir ficha
              </button>
            </div>
          </div>
        </div>
      ) : null}

    {editingEventId ? (
      <EditMaintenanceEventModal
        eventId={editingEventId}
        onClose={() => setEditingEventId(null)}
        onSaved={async () => {
          setEditingEventId(null);
          await load();
        }}
      />
    ) : null}
    </div>
  );
}

const heroPill: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #dbeafe",
  background: "rgba(255,255,255,0.84)",
  color: "#1d4ed8",
  fontWeight: 900,
  fontSize: 12,
};

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





