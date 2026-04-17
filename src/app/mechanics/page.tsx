// src/app/mechanics/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditMaintenanceEventModal from "./_components/EditMaintenanceEventModal";
import ActiveEventsSection from "./_components/ActiveEventsSection";
import OpenIncidentsSection from "./_components/OpenIncidentsSection";
import ResourceSelectorModal from "./_components/ResourceSelectorModal";
import MaintenanceResourcesSection from "./_components/MaintenanceResourcesSection";
import MechanicsOverviewSection from "./_components/MechanicsOverviewSection";

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
  maintenanceProfile: "OPERATIONAL" | "MAINTENANCE_ONLY";
  meterType: "HOURS" | "NONE";
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
  hoursAtService: number | null;
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

const EVENT_TYPE_LABEL: Record<MaintenanceEventType, string> = {
  SERVICE: "Servicio",
  OIL_CHANGE: "Cambio de aceite",
  REPAIR: "Reparación",
  INSPECTION: "Inspección",
  INCIDENT_REVIEW: "Revisión de incidencia",
  HOUR_ADJUSTMENT: "Ajuste de horas",
};

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
    const qq = q.trim().toLowerCase();
    if (!qq) return assets;
    return assets.filter((a) => {
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
  const dueAssets = filteredAssets.filter((a) => a.meterType === "HOURS" && a.service.state === "DUE");
  const warnAssets = filteredAssets.filter((a) => a.meterType === "HOURS" && a.service.state === "WARN");

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

  const orderedStandardAssets = orderedAssets.filter(
    (asset) => asset.maintenanceProfile === "OPERATIONAL"
  );
  const orderedOtherAssets = orderedAssets.filter(
    (asset) => asset.maintenanceProfile === "MAINTENANCE_ONLY"
  );

  function toAssetCard(asset: OverviewAssetRow) {
    const usesHours = asset.meterType === "HOURS";
    return {
      id: asset.id,
      entityType: "ASSET" as const,
      title: asset.name,
      href: `/mechanics/asset/${asset.id}`,
      summary: `${asset.type}${asset.model ? ` · ${asset.model}` : ""}${asset.year ? ` · ${asset.year}` : ""}${asset.plate ? ` · ${asset.plate}` : ""}${asset.chassisNumber ? ` · Bastidor: ${asset.chassisNumber}` : ""}${asset.maxPax ? ` · Pax máx: ${asset.maxPax}` : ""}`,
      operabilityStatus: asset.operabilityStatus,
      maintenanceProfile: asset.maintenanceProfile,
      meterType: asset.meterType,
      usesHours,
      currentHours: asset.currentHours,
      service: asset.service,
      lastServiceEventType: asset.lastServiceEventType,
      lastServiceEventAt: asset.lastServiceEventAt,
    };
  }

  const jetskiCards = useMemo(
    () =>
      orderedJetskis.map((jetski) => ({
        id: jetski.id,
        entityType: "JETSKI" as const,
        title: `Moto ${jetski.number}`,
        href: `/mechanics/jetski/${jetski.id}`,
        summary: `${jetski.model ? jetski.model : "—"}${jetski.year ? ` · ${jetski.year}` : ""}${jetski.plate ? ` · ${jetski.plate}` : ""}${jetski.chassisNumber ? ` · Bastidor: ${jetski.chassisNumber}` : ""}${jetski.maxPax ? ` · Pax máx: ${jetski.maxPax}` : ""}`,
        operabilityStatus: jetski.operabilityStatus,
        currentHours: jetski.currentHours,
        service: jetski.service,
        lastServiceEventType: jetski.lastServiceEventType,
        lastServiceEventAt: jetski.lastServiceEventAt,
      })),
    [orderedJetskis]
  );

  const standardAssetCards = useMemo(
    () => orderedStandardAssets.map(toAssetCard),
    [orderedStandardAssets]
  );

  const otherAssetCards = useMemo(
    () => orderedOtherAssets.map(toAssetCard),
    [orderedOtherAssets]
  );

  const dueAlertRows = useMemo(
    () => [
      ...dueJetskis.map((jetski) => ({
        id: jetski.id,
        label: `Moto ${jetski.number}`,
        currentHours: jetski.currentHours,
        dueAt: jetski.service.serviceDueAt,
        hoursLeft: jetski.service.hoursLeft,
      })),
      ...dueAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        currentHours: asset.currentHours,
        dueAt: asset.service.serviceDueAt,
        hoursLeft: asset.service.hoursLeft,
      })),
    ],
    [dueAssets, dueJetskis]
  );

  const warnAlertRows = useMemo(
    () => [
      ...warnJetskis.map((jetski) => ({
        id: jetski.id,
        label: `Moto ${jetski.number}`,
        currentHours: jetski.currentHours,
        dueAt: jetski.service.serviceDueAt,
        hoursLeft: jetski.service.hoursLeft,
      })),
      ...warnAssets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        currentHours: asset.currentHours,
        dueAt: asset.service.serviceDueAt,
        hoursLeft: asset.service.hoursLeft,
      })),
    ],
    [warnAssets, warnJetskis]
  );

  const selectorEventTypeOptions = useMemo(
    () =>
      Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => ({
        value: value as MaintenanceEventType,
        label,
      })),
    []
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
      const baseHours = currentHours ?? 0;

      const res = await fetch("/api/mechanics/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          type: "HOUR_ADJUSTMENT",
          hoursAtService: baseHours + delta,
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
            Flota técnica, revisiones, incidencias abiertas y accesos directos a ficha y recambios en una sola vista.
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
          <MechanicsOverviewSection
            urgentCount={urgentCount}
            warnCount={warnCount}
            jetskiCount={filteredJetskis.length}
            assetCount={filteredAssets.length}
            openEventsCount={openEventsCount}
            inProgressEventsCount={inProgressEventsCount}
            externalEventsCount={externalEventsCount}
            dueRows={dueAlertRows}
            warnRows={warnAlertRows}
          />

          <section>
      
            <OpenIncidentsSection openIncidents={openIncidents} />

            <ActiveEventsSection
              openEvents={openEvents}
              onEdit={(eventId) => setEditingEventId(eventId)}
            />

            <MaintenanceResourcesSection
              title="Jetskis"
              rows={jetskiCards}
              onQuickAdjust={quickAdjust}
              onOpenAdjust={(entityType, entityId) => {
                router.push(buildDetailHref(entityType, entityId, "HOUR_ADJUSTMENT"));
              }}
            />

            {standardAssetCards.length ? (
              <MaintenanceResourcesSection
                title="Assets operativos"
                rows={standardAssetCards}
                onQuickAdjust={quickAdjust}
                onOpenAdjust={(entityType, entityId) => {
                  router.push(buildDetailHref(entityType, entityId, "HOUR_ADJUSTMENT"));
                }}
              />
            ) : null}

            {otherAssetCards.length ? (
              <MaintenanceResourcesSection
                title="Maintenance-only"
                rows={otherAssetCards}
                onQuickAdjust={quickAdjust}
                onOpenAdjust={(entityType, entityId) => {
                  router.push(buildDetailHref(entityType, entityId, "HOUR_ADJUSTMENT"));
                }}
              />
            ) : null}
          </section>
        </div>
      )}

      <ResourceSelectorModal
        open={selectorOpen}
        entityType={selectorEntityType}
        entityId={selectorEntityId}
        eventType={selectorEventType}
        jetskis={jetskis}
        assets={assets}
        eventTypeOptions={selectorEventTypeOptions}
        onClose={() => setSelectorOpen(false)}
        onEntityTypeChange={(value) => {
          setSelectorEntityType(value);
          setSelectorEntityId("");
        }}
        onEntityIdChange={setSelectorEntityId}
        onEventTypeChange={setSelectorEventType}
        onOpenDetail={() => {
          if (!selectorEntityId) return;
          router.push(buildDetailHref(selectorEntityType, selectorEntityId, selectorEventType));
          setSelectorOpen(false);
        }}
      />

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






