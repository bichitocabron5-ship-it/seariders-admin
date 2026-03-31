// src/app/mechanics/[entityType]/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { eurFromCents } from "@/lib/mechanics-format";
import EditMaintenanceEventModal from "@/app/mechanics/_components/EditMaintenanceEventModal";
import CreateMaintenanceEventModal from "@/app/mechanics/[entityType]/[id]/_components/CreateMaintenanceEventModal";
import MaintenanceEventsSection from "@/app/mechanics/[entityType]/[id]/_components/MaintenanceEventsSection";
import MaintenanceDetailOverviewSection from "@/app/mechanics/[entityType]/[id]/_components/MaintenanceDetailOverviewSection";
import RecurringFaultCodesSection from "@/app/mechanics/[entityType]/[id]/_components/RecurringFaultCodesSection";

type MaintenanceEntityType = "JETSKI" | "ASSET";
type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";

type DetailResponse = {
  ok: true;
  entityType: MaintenanceEntityType;
  entity: {
    operabilityStatus: string;
    id: string;
    displayName: string;
    status: string;
    createdAt: string;
    updatedAt: string;

    // jetski
    number?: number;
    owner?: string | null;

    // asset
    type?: string;
    code?: string | null;
    note?: string | null;
    isMotorized?: boolean;

    // comunes
    plate?: string | null;
    chassisNumber?: string | null;
    model?: string | null;
    year?: number | null;
    maxPax?: number | null;
    currentHours?: number | null;
    lastServiceHours?: number | null;
    serviceIntervalHours?: number;
    serviceWarnHours?: number;
  };
  service: {
    state: ServiceState;
    hoursSinceService: number | null;
    serviceDueAt: number;
    hoursLeft: number | null;
  };
  lastServiceHoursEffective: number | null;
  lastEvent: EventRow | null;
  events: EventRow[];
};

type EventRow = {
  id: string;
    entityType: MaintenanceEntityType;
    type: MaintenanceEventType;
    hoursAtService: number;
    note: string | null;
    createdAt: string;
    createdByUserId: string | null;
    createdByUser: {
      id: string;
      username?: string | null;
      email?: string | null;
      fullName?: string | null;
    } | null;

  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  supplierName: string | null;
  externalWorkshop: boolean;
  costCents: number | null;
  laborCostCents: number | null;
  partsCostCents: number | null;
  resolvedAt: string | null;
  faultCode: string | null;
  reopenCount: number;

  partUsages: Array<{
    id: string;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    sparePart: {
      id: string;
      name: string;
      sku: string;
      unit: string;
    } | null;
  }>;
};

type FaultCodeRow = {
  id: string;
  brand: string;
  code: string;
  system: string | null;
  titleEs: string;
  descriptionEs: string | null;
  likelyCausesEs: string | null;
  recommendedActionEs: string | null;
  severityHint: string | null;
  verificationStatus:
    | "VERIFIED_OFFICIAL"
    | "VERIFIED_COMMUNITY"
    | "INTERNAL_OBSERVED"
    | "PENDING_VERIFY";
  source: string | null;
};

type FaultCodeLookupRow = FaultCodeRow;
type FaultCodeCatalogRow = FaultCodeRow;

const EVENT_TYPE_LABEL: Record<MaintenanceEventType, string> = {
  SERVICE: "Servicio",
  OIL_CHANGE: "Cambio de aceite",
  REPAIR: "Reparación",
  INSPECTION: "Inspección",
  INCIDENT_REVIEW: "Revisión de incidencia",
  HOUR_ADJUSTMENT: "Ajuste de horas",
};

const SEVERITY_LABEL = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
} as const;

const STATUS_LABEL = {
  OPEN: "Abierta",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelta",
  EXTERNAL: "Externa",
  CANCELED: "Cancelada",
} as const;

function hoursSince(dateIso: string | null | undefined) {
  if (!dateIso) return null;

  const t = new Date(dateIso).getTime();
  if (!Number.isFinite(t)) return null;

  const diffMs = Date.now() - t;
  if (diffMs < 0) return 0;

  return diffMs / (1000 * 60 * 60);
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

export default function MechanicsDetailPage() {
  const router = useRouter();
  const params = useParams<{ entityType: string; id: string }>();
  const searchParams = useSearchParams();
  const eventIdFromQuery = searchParams.get("eventId");
  const autoOpenedRef = useRef(false);

  const entityType = (params.entityType?.toUpperCase() ?? "") as MaintenanceEntityType;
  const entityId = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<MaintenanceEventType>("SERVICE");
  const [hoursAtService, setHoursAtService] = useState("");
  const [note, setNote] = useState("");
  const [applyToEntity, setApplyToEntity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [eventStatus, setEventStatus] = useState<"OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED">("RESOLVED");
  const [supplierName, setSupplierName] = useState("");
  const [externalWorkshop, setExternalWorkshop] = useState(false);
  const [costCents, setCostCents] = useState("");
  const [laborCostCents, setLaborCostCents] = useState("");
  const [partsCostCents, setPartsCostCents] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [faultCodeOptions, setFaultCodeOptions] = useState<FaultCodeLookupRow[]>([]);
  const [faultCodeLoading, setFaultCodeLoading] = useState(false);
  const [faultCodeLookupError, setFaultCodeLookupError] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [recurringFaultCatalog, setRecurringFaultCatalog] = useState<Record<string, FaultCodeCatalogRow>>({});
  const [recurringFaultCatalogLoading, setRecurringFaultCatalogLoading] = useState(false);
  const [resolvedAt, setResolvedAt] = useState("");
  const [affectsOperability, setAffectsOperability] = useState(false);
  const [operabilityOnOpen, setOperabilityOnOpen] = useState("");
  const [operabilityOnResolved, setOperabilityOnResolved] = useState("");
  const [partsUsed, setPartsUsed] = useState<
    Array<{
      sparePartId: string;
      qty: string;
      unitCostCents: string;
    }>
  >([]);

  const [parts, setParts] = useState<
  Array<{
    id: string;
    sku: string | null;
    name: string;
    unit: string | null;
    stockQty: number;
    costPerUnitCents: number | null;
  }>
>([]);

  useEffect(() => {
    if (!eventIdFromQuery) return;
    setEditingEventId(eventIdFromQuery);
  }, [eventIdFromQuery]);

  const openEventModal = useCallback(
    (nextEventType: MaintenanceEventType = "SERVICE") => {
      if (!data) return;
      setEditingEventId(null);
      setEventType(nextEventType);
      setHoursAtService(
        data.entity.currentHours !== null && data.entity.currentHours !== undefined
          ? String(data.entity.currentHours)
          : ""
      );
      setNote("");
      setApplyToEntity(true);
      setModalError(null);
      setOpen(true);
      setSeverity("MEDIUM");
      setEventStatus("RESOLVED");
      setSupplierName("");
      setExternalWorkshop(false);
      setCostCents("");
      setLaborCostCents("");
      setPartsCostCents("");
      setFaultCode("");
      setResolvedAt("");
      setAffectsOperability(false);
      setOperabilityOnOpen("");
      setOperabilityOnResolved("");
      setPartsUsed([]);
    },
    [data]
  );

  const load = useCallback(async () => {
  if (!entityType || !entityId) return;

  setLoading(true);
  setError(null);
  try {
    const [detailRes, partsRes] = await Promise.all([
      fetch(`/api/mechanics/entity-detail?entityType=${entityType}&entityId=${entityId}&take=100`, {
        cache: "no-store"
      }),
      fetch("/api/mechanics/parts", { cache: "no-store" }),
    ]);

    if (!detailRes.ok) throw new Error(await detailRes.text());
    if (!partsRes.ok) throw new Error(await partsRes.text());

    const detailJson = (await detailRes.json()) as DetailResponse;
    const partsJson = await partsRes.json();

    setData(detailJson);
    setParts(partsJson.rows ?? []);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error cargando ficha");
  } finally {
    setLoading(false);
  }
}, [entityId, entityType]);
  
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    autoOpenedRef.current = false;
  }, [entityId, searchParams]);

  useEffect(() => {
    if (!data || autoOpenedRef.current) return;
    if (searchParams.get("new") !== "1") return;

    const requestedType = searchParams.get("type");
    const nextEventType = (
      requestedType &&
      Object.prototype.hasOwnProperty.call(EVENT_TYPE_LABEL, requestedType)
        ? requestedType
        : "SERVICE"
    ) as MaintenanceEventType;

    autoOpenedRef.current = true;
    openEventModal(nextEventType);
  }, [data, openEventModal, searchParams]);

  const title = useMemo(() => {
    if (!data) return "Ficha técnica";
    return data.entity.displayName;
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function loadFaultCodes() {
      const q = faultCode.trim();

      if (!q) {
        setFaultCodeOptions([]);
        setFaultCodeLookupError(null);
        return;
      }

      try {
        setFaultCodeLoading(true);
        setFaultCodeLookupError(null);

        const qs = new URLSearchParams({
          q,
          brand: "SEA_DOO",
          limit: "8",
        });

        const res = await fetch(`/api/mechanics/fault-codes/lookup?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();

        if (!cancelled) {
          setFaultCodeOptions(json.rows ?? []);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setFaultCodeLookupError(
            e instanceof Error ? e.message : "Error buscando códigos de avería"
          );
        }
      } finally {
        if (!cancelled) {
          setFaultCodeLoading(false);
        }
      }
    }

    loadFaultCodes();

    return () => {
      cancelled = true;
    };
  }, [faultCode]);

  const fleetKpis = useMemo(() => {
    if (!data) {
      return {
        totalEvents: 0,
        totalCostCents: 0,
        totalLaborCostCents: 0,
        totalPartsCostCents: 0,
        totalPartUsageQty: 0,
        totalPartUsageCostCents: 0,
        totalHoursSinceService: null as number | null,
        costPerHourCents: null as number | null,
      };
    }

    const totals = data.events.reduce(
      (acc, e) => {
        acc.totalEvents += 1;
        acc.totalCostCents += Number(e.costCents ?? 0);
        acc.totalLaborCostCents += Number(e.laborCostCents ?? 0);
        acc.totalPartsCostCents += Number(e.partsCostCents ?? 0);

        for (const p of e.partUsages ?? []) {
          acc.totalPartUsageQty += Number(p.qty ?? 0);
          acc.totalPartUsageCostCents += Number(p.totalCostCents ?? 0);
        }

        return acc;
      },
      {
        totalEvents: 0,
        totalCostCents: 0,
        totalLaborCostCents: 0,
        totalPartsCostCents: 0,
        totalPartUsageQty: 0,
        totalPartUsageCostCents: 0,
      }
    );

    const totalHoursSinceService =
      typeof data.service.hoursSinceService === "number"
        ? data.service.hoursSinceService
        : null;

    const costPerHourCents =
      totalHoursSinceService && totalHoursSinceService > 0
        ? Math.round(totals.totalCostCents / totalHoursSinceService)
        : null;

    return {
      ...totals,
      totalHoursSinceService,
      costPerHourCents,
    };
  }, [data]);

  const recurringFaults = useMemo(() => {
    if (!data) return [];

    const map = new Map<
      string,
      {
        code: string;
        count: number;
        lastSeenAt: string | null;
        totalCostCents: number;
        totalPartsCostCents: number;
      }
    >();

    for (const e of data.events) {
      const code = e.faultCode?.trim();
      if (!code) continue;

      const current = map.get(code) ?? {
        code,
        count: 0,
        lastSeenAt: null,
        totalCostCents: 0,
        totalPartsCostCents: 0,
      };

      current.count += 1;
      current.totalCostCents += Number(e.costCents ?? 0);

      const partsCostFromUsages = (e.partUsages ?? []).reduce(
        (acc, p) => acc + Number(p.totalCostCents ?? 0),
        0
      );

        current.totalPartsCostCents += partsCostFromUsages;

        if (!current.lastSeenAt || new Date(e.createdAt) > new Date(current.lastSeenAt)) {
          current.lastSeenAt = e.createdAt;
        }

        map.set(code, current);
      }

      return Array.from(map.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.totalCostCents - a.totalCostCents;
      });
    }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecurringFaultCatalog() {
      const codes = recurringFaults.map((f) => f.code).filter(Boolean);
      if (codes.length === 0) {
        setRecurringFaultCatalog({});
        return;
      }

      try {
        setRecurringFaultCatalogLoading(true);

        const qs = new URLSearchParams({
          codes: codes.join(","),
          brand: "SEA_DOO",
        });

        const res = await fetch(`/api/mechanics/fault-codes/by-codes?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        const map: Record<string, FaultCodeCatalogRow> = {};

        for (const row of json.rows ?? []) {
          map[row.code.toUpperCase()] = row;
        }

        if (!cancelled) {
          setRecurringFaultCatalog(map);
        }
      } catch {
        if (!cancelled) {
          setRecurringFaultCatalog({});
        }
      } finally {
        if (!cancelled) {
          setRecurringFaultCatalogLoading(false);
        }
      }
    }

    loadRecurringFaultCatalog();

    return () => {
      cancelled = true;
    };
  }, [recurringFaults]);

  const selectedFaultCode = useMemo(() => {
    const normalized = faultCode.trim().toUpperCase();
    if (!normalized) return null;

    return (
      faultCodeOptions.find((row) => row.code.toUpperCase() === normalized) ??
      faultCodeOptions[0] ??
      null
    );
  }, [faultCode, faultCodeOptions]);

  const normalizedFaultCode = faultCode.trim().toUpperCase();

  const exactFaultCodeMatch = useMemo(() => {
    if (!normalizedFaultCode) return null;
    return (
      faultCodeOptions.find(
        (row) => row.code.trim().toUpperCase() === normalizedFaultCode
      ) ?? null
    );
  }, [faultCodeOptions, normalizedFaultCode]);

  const activeEvents = useMemo(() => {
    if (!data) return [];

    const rows = data.events.filter(
      (e) =>
        e.status === "OPEN" ||
        e.status === "IN_PROGRESS" ||
        e.status === "EXTERNAL"
    );

    function priorityScore(e: (typeof rows)[number]) {
      const priority = eventPriorityLabel({
        status: e.status,
        severity: e.severity,
        createdAt: e.createdAt,
      });

      const map: Record<string, number> = {
        CRÍTICA: 5,
        "MUY ALTA": 4,
        ALTA: 3,
        MEDIA: 2,
        NORMAL: 1,
      };

      return map[priority] ?? 0;
    }

    return [...rows].sort((a, b) => {
      const pa = priorityScore(a);
      const pb = priorityScore(b);

      if (pb !== pa) return pb - pa;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [data]);

  const resolvedEvents = useMemo(() => {
    if (!data) return [];
    return data.events.filter(
      (e) => e.status === "RESOLVED" || e.status === "CANCELED"
    );
  }, [data]);

  async function reopenEvent(eventId: string) {
    try {
      const res = await fetch(`/api/mechanics/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "OPEN",
          resolvedAt: null,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error reabriendo evento");
    }
  }

  async function submitEvent() {
    try {
      if (!data) return;
      setBusy(true);
      setModalError(null);

      const h = hoursAtService.trim() ? Number(hoursAtService) : undefined;
      if (hoursAtService.trim() && (Number.isNaN(h) || h! < 0)) {
        throw new Error("Horas inválidas.");
      }

      const parsedPartsUsed = partsUsed
        .filter((p) => p.sparePartId && p.qty.trim())
        .map((p) => ({
          sparePartId: p.sparePartId,
          qty: Number(p.qty),
          unitCostCents: p.unitCostCents.trim() ? Number(p.unitCostCents) : null,
        }));

      const res = await fetch("/api/mechanics/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: data.entityType,
          entityId: data.entity.id,
          type: eventType,
          hoursAtService: h,
          note: note.trim() ? note.trim() : null,
          applyToEntity,

          severity,
          status: eventStatus,
          supplierName: supplierName.trim() || null,
          externalWorkshop,
          costCents: costCents.trim() ? Number(costCents) : null,
          laborCostCents: laborCostCents.trim() ? Number(laborCostCents) : null,
          partsCostCents: partsCostCents.trim() ? Number(partsCostCents) : null,
          resolvedAt: resolvedAt.trim() ? new Date(resolvedAt).toISOString() : null,
          faultCode: faultCode.trim() || null,
          affectsOperability,
          operabilityOnOpen: operabilityOnOpen || null,
          operabilityOnResolved: operabilityOnResolved || null,
          partsUsed: parsedPartsUsed,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "No se pudo registrar el evento.");
      }

      setOpen(false);
      setNote("");
      await load();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageShell}>
      <div
        style={{
          ...softCard,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
          <button
            type="button"
            onClick={() => router.push("/mechanics")}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 12,
              padding: "8px 10px",
              fontWeight: 900,
              marginBottom: 10,
            }}
          >
            Volver
          </button>

          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0369a1" }}>
            Ficha técnica
          </div>
          <div style={{ fontWeight: 950, fontSize: 34, lineHeight: 1.02 }}>{title}</div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            Historial tecnico, estado de servicio, averias recurrentes y coste acumulado del recurso.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
          <button
            type="button"
            onClick={() => load()}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontWeight: 900,
            }}
          >
            Refrescar
          </button>

          <button
            type="button"
            onClick={() => openEventModal("SERVICE")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            Crear evento
          </button>
        </div>
      </div>

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <MaintenanceDetailOverviewSection
            entityType={data.entityType}
            entity={data.entity}
            service={data.service}
            lastServiceHoursEffective={data.lastServiceHoursEffective}
          />

          <RecurringFaultCodesSection
            loading={recurringFaultCatalogLoading}
            recurringFaults={recurringFaults}
            recurringFaultCatalog={recurringFaultCatalog}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Kpi title="Eventos totales" value={fleetKpis.totalEvents} />
            <Kpi title="Coste mantenimiento total" value={eurFromCents(fleetKpis.totalCostCents)} />
            <Kpi title="Coste mano de obra" value={eurFromCents(fleetKpis.totalLaborCostCents)} />
            <Kpi title="Coste piezas (eventos)" value={eurFromCents(fleetKpis.totalPartsCostCents)} />
            <Kpi title="Recambios consumidos" value={fleetKpis.totalPartUsageQty} />
            <Kpi title="Coste recambios real" value={eurFromCents(fleetKpis.totalPartUsageCostCents)} />
            <Kpi
              title="Coste por hora"
              value={
                fleetKpis.costPerHourCents != null
                  ? eurFromCents(fleetKpis.costPerHourCents)
                  : "—"
              }
            />
          </div>

          <MaintenanceEventsSection
            activeEvents={activeEvents}
            resolvedEvents={resolvedEvents}
            eventTypeLabel={EVENT_TYPE_LABEL}
            onEdit={(eventId) => setEditingEventId(eventId)}
            onReopen={reopenEvent}
          />
        </>
      ) : null}

      <CreateMaintenanceEventModal
        open={open}
        busy={busy}
        modalError={modalError}
        eventType={eventType}
        setEventType={setEventType}
        eventTypeLabel={EVENT_TYPE_LABEL}
        hoursAtService={hoursAtService}
        setHoursAtService={setHoursAtService}
        note={note}
        setNote={setNote}
        severity={severity}
        setSeverity={setSeverity}
        severityLabel={SEVERITY_LABEL}
        eventStatus={eventStatus}
        setEventStatus={setEventStatus}
        statusLabel={STATUS_LABEL}
        supplierName={supplierName}
        setSupplierName={setSupplierName}
        externalWorkshop={externalWorkshop}
        setExternalWorkshop={setExternalWorkshop}
        costCents={costCents}
        setCostCents={setCostCents}
        laborCostCents={laborCostCents}
        setLaborCostCents={setLaborCostCents}
        partsCostCents={partsCostCents}
        setPartsCostCents={setPartsCostCents}
        faultCode={faultCode}
        setFaultCode={setFaultCode}
        faultCodeOptions={faultCodeOptions}
        faultCodeLoading={faultCodeLoading}
        faultCodeLookupError={faultCodeLookupError}
        selectedFaultCode={selectedFaultCode}
        normalizedFaultCode={normalizedFaultCode}
        exactFaultCodeMatch={exactFaultCodeMatch}
        resolvedAt={resolvedAt}
        setResolvedAt={setResolvedAt}
        parts={parts}
        partsUsed={partsUsed}
        setPartsUsed={setPartsUsed}
        applyToEntity={applyToEntity}
        setApplyToEntity={setApplyToEntity}
        affectsOperability={affectsOperability}
        setAffectsOperability={setAffectsOperability}
        operabilityOnOpen={operabilityOnOpen}
        setOperabilityOnOpen={setOperabilityOnOpen}
        operabilityOnResolved={operabilityOnResolved}
        setOperabilityOnResolved={setOperabilityOnResolved}
        onClose={() => setOpen(false)}
        onSubmit={submitEvent}
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





