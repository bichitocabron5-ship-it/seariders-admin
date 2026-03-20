// src/app/mechanics/[entityType]/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fmtHours, eurFromCents, isNegativeNumber, fmtNumber } from "@/lib/mechanics-format";
import EditMaintenanceEventModal from "@/app/mechanics/_components/EditMaintenanceEventModal";
import { operabilityBadgeStyle, operabilityLabel } from "@/lib/operability-ui";

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

  const d = h / 24;
  return `${fmtNumber(d, 1)} d`;
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

  if (priority === "CRÍTICA") {
    return {
      ...base,
      borderColor: "#fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
    };
  }

  if (priority === "MUY ALTA") {
    return {
      ...base,
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  if (priority === "ALTA") {
    return {
      ...base,
      borderColor: "#fed7aa",
      background: "#fff7ed",
      color: "#c2410c",
    };
  }

  if (priority === "MEDIA") {
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

function stateBadgeStyle(state: ServiceState): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
  };

  if (state === "DUE") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }
  if (state === "WARN") {
    return { ...base, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" };
  }
  if (state === "UNKNOWN") {
    return { ...base, borderColor: "#d1d5db", background: "#f9fafb", color: "#374151" };
  }
  return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
}

function stateLabel(state: ServiceState) {
  if (state === "DUE") return "DUE";
  if (state === "WARN") return "WARN";
  if (state === "UNKNOWN") return "UNKNOWN";
  return "OK";
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

function isEditableEventStatus(status: string) {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "EXTERNAL";
}

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

  function renderEventCard(e: (typeof data extends null ? never : NonNullable<typeof data>["events"][number])) {
    const partsSummary = e.partUsages.reduce(
      (acc, p) => {
        acc.qty += Number(p.qty ?? 0);
        acc.cost += Number(p.totalCostCents ?? 0);
        return acc;
      },
      { qty: 0, cost: 0 }
    );

  const openAge = formatOpenAge(e.createdAt);
    const priority = eventPriorityLabel({
      status: e.status,
      severity: e.severity,
      createdAt: e.createdAt,
    });

    const realPartsCost = e.partUsages.reduce(
      (acc, p) => acc + Number(p.totalCostCents ?? 0),
      0
    );

    const totalKnownCost =
    Number(e.laborCostCents ?? 0) + Number(realPartsCost ?? 0);

    return (
      <div
        key={e.id}
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
              {EVENT_TYPE_LABEL[e.type] ?? e.type}
              {typeof e.hoursAtService === "number" ? ` · ${fmtHours(e.hoursAtService)} h` : ""}
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {fmtDateTime(e.createdAt)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {e.status}
            </div>

            <div
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {e.severity}
            </div>

            <div style={priorityBadgeStyle(priority)}>{priority}</div>

              {isEditableEventStatus(e.status) ? (
                <button
                  type="button"
                  onClick={() => setEditingEventId(e.id)}
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

              {e.status === "RESOLVED" ? (
                <button
                  type="button"
                  onClick={() => reopenEvent(e.id)}
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

        {e.faultCode ? (
          <div style={{ fontSize: 13 }}>
            <b>Fault code:</b> {e.faultCode}
          </div>
        ) : null}

        {e.reopenCount > 0 ? (
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Reabierto {e.reopenCount}x
          </div>
        ) : null}

        {e.note ? (
          <div style={{ fontSize: 13 }}>{e.note}</div>
        ) : null}

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Coste: <b>{eurFromCents(e.costCents)}</b>
          {e.laborCostCents != null ? ` · Mano de obra: ${eurFromCents(e.laborCostCents)}` : ""}
          {e.partsCostCents != null ? ` · Piezas: ${eurFromCents(e.partsCostCents)}` : ""}
        </div>

        {isEditableEventStatus(e.status) ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
              fontSize: 13,
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.72 }}>Tiempo abierto</div>
              <div style={{ marginTop: 4, fontWeight: 900 }}>{openAge}</div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.72 }}>Coste piezas real</div>
              <div style={{ marginTop: 4, fontWeight: 900 }}>
                {eurFromCents(realPartsCost)}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.72 }}>Coste conocido actual</div>
              <div style={{ marginTop: 4, fontWeight: 900 }}>
                {eurFromCents(totalKnownCost)}
              </div>
            </div>
          </div>
        ) : null}

        {e.partUsages?.length ? (
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

            {e.partUsages.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  {p.sparePart?.name ?? "Recambio eliminado"}
                  {p.sparePart?.sku ? ` · ${p.sparePart.sku}` : ""}
                  {p.sparePart?.unit ? ` · ${p.qty} ${p.sparePart.unit}` : ` · qty ${p.qty}`}
                </div>

                <div style={{ fontWeight: 700 }}>
                  {eurFromCents(p.totalCostCents)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
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
            Ficha tecnica
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
          <div
            style={{
              ...softCard,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 22 }}>{data.entity.displayName}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {data.entityType === "JETSKI" ? "JETSKI" : data.entity.type}
                  {data.entity.model ? ` · ${data.entity.model}` : ""}
                  {data.entity.year ? ` · ${data.entity.year}` : ""}
                  {data.entity.plate ? ` · ${data.entity.plate}` : ""}
                  {data.entity.chassisNumber ? ` · Bastidor: ${data.entity.chassisNumber}` : ""}
                  {data.entity.maxPax ? ` · Pax máx: ${data.entity.maxPax}` : ""}
                  {data.entity.code ? ` · ${data.entity.code}` : ""}
                </div>
              </div>

              <div style={stateBadgeStyle(data.service.state)}>{stateLabel(data.service.state)}</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>Estado operativo:</span>
              <span style={operabilityBadgeStyle(data.entity.operabilityStatus ?? data.entity.status)}>
                {operabilityLabel(data.entity.operabilityStatus ?? data.entity.status)}
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
            <Kpi title="Horas actuales" value={fmtHours(data.entity.currentHours)} />
            <Kpi title="Desde última revisión" value={fmtHours(data.service.hoursSinceService)} />
            <Kpi title="Próxima revisión" value={fmtHours(data.service.serviceDueAt)} />
            <Kpi
              title="Horas restantes"
              value={fmtHours(data.service.hoursLeft)}
              danger={isNegativeNumber(data.service.hoursLeft)}
            />
            <Kpi title="Última revisión efectiva" value={fmtHours(data.lastServiceHoursEffective)} />
          </div>

          <div
            style={{
              ...softCard,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 20 }}>
              Códigos de avería recurrentes
            </div>

            {recurringFaultCatalogLoading ? (
              <div style={{ opacity: 0.72 }}>Cargando catálogo de códigos de avería...</div>
            ) : recurringFaults.length === 0 ? (
              <div style={{ opacity: 0.72 }}>No hay códigos de avería repetidos registrados.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {recurringFaults.map((f) => {
                  const catalog = recurringFaultCatalog[f.code.toUpperCase()] ?? null;

                  return (
                    <div
                      key={f.code}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fafafa",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{f.code}</div>

                        {catalog?.system ? (
                          <div
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {catalog.system}
                          </div>
                        ) : null}

                        {catalog?.severityHint ? (
                          <div
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            Severidad sugerida: {catalog.severityHint}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {catalog?.titleEs ?? "Código sin descripción en catálogo"}
                      </div>

                      {catalog?.descriptionEs ? (
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                          {catalog.descriptionEs}
                        </div>
                      ) : null}

                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        <b>{f.count}</b> vez/veces · última vez: {fmtDateTime(f.lastSeenAt)}
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        Coste acumulado: {eurFromCents(f.totalCostCents)} Coste piezas:{" "}
                        {eurFromCents(f.totalPartsCostCents)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

          <div
            style={{
              ...softCard,
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
                  {activeEvents.map((e) => renderEventCard(e))}
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
                Historial resuelto · {resolvedEvents.length}
              </div>

              {resolvedEvents.length === 0 ? (
                <div style={{ opacity: 0.72 }}>No hay eventos resueltos o cancelados.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {resolvedEvents.map((e) => renderEventCard(e))}
                </div>
              )}
            </div>
          </div>

          </div>
        </>
      ) : null}

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => (busy ? null : setOpen(false))}
        >
          <div
            style={{
              width: "min(1100px, 100%)",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: 18,
              border: "1px solid #dbe4ea",
              padding: 14,
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Crear evento técnico</div>
              <button
                type="button"
                onClick={() => (busy ? null : setOpen(false))}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontWeight: 900,
                }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Tipo de evento
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as MaintenanceEventType)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                >
                  {Object.entries(EVENT_TYPE_LABEL).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                Horas en el momento del evento
                <input
                  value={hoursAtService}
                  onChange={(e) => setHoursAtService(e.target.value)}
                  placeholder="Vacío = currentHours"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: "1 / -1" }}>
                Nota
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
              </label>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Severidad
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  >
                    {Object.entries(SEVERITY_LABEL).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Estado
                  <select
                    value={eventStatus}
                    onChange={(e) =>
                      setEventStatus(e.target.value as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED")
                    }
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  >
                    {Object.entries(STATUS_LABEL).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Proveedor / taller
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ej: Mecánico Escala"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={externalWorkshop}
                    onChange={(e) => setExternalWorkshop(e.target.checked)}
                  />
                  Taller externo
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Coste total (céntimos)
                  <input
                    value={costCents}
                    onChange={(e) => setCostCents(e.target.value)}
                    placeholder="Ej: 13800"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Mano de obra (céntimos)
                  <input
                    value={laborCostCents}
                    onChange={(e) => setLaborCostCents(e.target.value)}
                    placeholder="Ej: 12000"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Coste piezas (céntimos)
                  <input
                    value={partsCostCents}
                    onChange={(e) => setPartsCostCents(e.target.value)}
                    placeholder="Ej: 1800"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Código de avería
                  <input
                    value={faultCode}
                    onChange={(e) => setFaultCode(e.target.value.toUpperCase())}
                    placeholder="Ej: P0562 / P0122 / U0129"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    border: "1px solid #e5e7eb",
                    background: "#fafafa",
                    borderRadius: 12,
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Ayuda de código de avería</div>

                  {!faultCode.trim() ? (
                    <div style={{ fontSize: 13, opacity: 0.72 }}>
                      Escribe un código para ver su descripción, causas probables y acción recomendada.
                    </div>
                  ) : faultCodeLoading ? (
                    <div style={{ fontSize: 13, opacity: 0.72 }}>Buscando código...</div>
                  ) : faultCodeLookupError ? (
                    <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 900 }}>
                      {faultCodeLookupError}
                    </div>
                  ) : selectedFaultCode ? (
                    <>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 950 }}>{selectedFaultCode.code}</div>
                        {selectedFaultCode.system ? (
                          <div
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {selectedFaultCode.system}
                          </div>
                        ) : null}
                        {selectedFaultCode.severityHint ? (
                          <div
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              border: "1px solid #e5e7eb",
                              background: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            Severidad sugerida: {selectedFaultCode.severityHint}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 13 }}>
                        <b>{selectedFaultCode.titleEs}</b>
                      </div>

                      {selectedFaultCode.descriptionEs ? (
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                          <b>Descripción:</b> {selectedFaultCode.descriptionEs}
                        </div>
                      ) : null}

                      {selectedFaultCode.likelyCausesEs ? (
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                          <b>Causas probables:</b> {selectedFaultCode.likelyCausesEs}
                        </div>
                      ) : null}

                      {selectedFaultCode.recommendedActionEs ? (
                        <div style={{ fontSize: 13, opacity: 0.9 }}>
                          <b>Acción recomendada:</b> {selectedFaultCode.recommendedActionEs}
                        </div>
                      ) : null}

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {selectedFaultCode.source ? `Fuente: ${selectedFaultCode.source}` : "Fuente no indicada"}
                      </div>

                      {faultCodeOptions.length > 1 ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 900 }}>Coincidencias</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {faultCodeOptions.map((row) => (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => setFaultCode(row.code)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  border:
                                    row.code === selectedFaultCode.code
                                      ? "1px solid #111"
                                      : "1px solid #e5e7eb",
                                  background: row.code === selectedFaultCode.code ? "#111" : "#fff",
                                  color: row.code === selectedFaultCode.code ? "#fff" : "#111",
                                  fontSize: 12,
                                  fontWeight: 900,
                                }}
                              >
                                {row.code}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.72 }}>
                      No hay coincidencias en el catálogo para este código.
                    </div>
                  )}
                </div>

                {normalizedFaultCode ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 10,
                      border: exactFaultCodeMatch
                        ? "1px solid #bbf7d0"
                        : "1px solid #fde68a",
                      background: exactFaultCodeMatch ? "#f0fdf4" : "#fffbeb",
                      color: exactFaultCodeMatch ? "#166534" : "#92400e",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {exactFaultCodeMatch
                      ? "Código reconocido en catálogo."
                      : "Código no encontrado en catálogo. Se guardará como código libre."}
                  </div>
                ) : null}

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Resuelto el
                  <input
                    type="datetime-local"
                    value={resolvedAt}
                    onChange={(e) => setResolvedAt(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 8, overflow: "auto" }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Piezas usadas</div>

                {partsUsed.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 2fr) minmax(90px, 110px) minmax(120px, 150px) auto",
                        gap: 8,
                        alignItems: "end",
                      }}
                    >
                    <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      Recambio
                      <select
                        value={p.sparePartId}
                        onChange={(e) => {
                          const next = [...partsUsed];
                          next[idx].sparePartId = e.target.value;
                          const selected = parts.find((x) => x.id === e.target.value);
                          if (selected && !next[idx].unitCostCents) {
                            next[idx].unitCostCents =
                              selected.costPerUnitCents != null ? String(selected.costPerUnitCents) : "";
                          }
                          setPartsUsed(next);
                        }}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      >
                        <option value="">Selecciona recambio...</option>
                        {parts.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} {sp.unit ? `· ${sp.unit}` : ""} · stock {sp.stockQty}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      Qty
                      <input
                        value={p.qty}
                        onChange={(e) => {
                          const next = [...partsUsed];
                          next[idx].qty = e.target.value;
                          setPartsUsed(next);
                        }}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      Coste unit. cént.
                      <input
                        value={p.unitCostCents}
                        onChange={(e) => {
                          const next = [...partsUsed];
                          next[idx].unitCostCents = e.target.value;
                          setPartsUsed(next);
                        }}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setPartsUsed(partsUsed.filter((_, i) => i !== idx))}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        fontWeight: 900,
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setPartsUsed([
                        ...partsUsed,
                        { sparePartId: "", qty: "", unitCostCents: "" },
                      ])
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      fontWeight: 900,
                    }}
                  >
                    + Añadir pieza
                  </button>
                </div>
              </div>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={applyToEntity}
                  onChange={(e) => setApplyToEntity(e.target.checked)}
                />
                Aplicar a la entidad
              </label>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>Operatividad en Plataforma</div>

                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={affectsOperability}
                    onChange={(e) => setAffectsOperability(e.target.checked)}
                  />
                  Este evento afecta a la operatividad actual
                </label>

                {affectsOperability ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Estado al abrir/reabrir
                      <select
                        value={operabilityOnOpen}
                        onChange={(e) => setOperabilityOnOpen(e.target.value)}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      >
                        <option value="">Selecciona...</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="DAMAGED">DAMAGED</option>
                        <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                        <option value="OPERATIONAL">OPERATIONAL</option>
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Estado al resolver
                      <select
                        value={operabilityOnResolved}
                        onChange={(e) => setOperabilityOnResolved(e.target.value)}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      >
                        <option value="">Selecciona...</option>
                        <option value="OPERATIONAL">OPERATIONAL</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                        <option value="DAMAGED">DAMAGED</option>
                        <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            {modalError ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#991b1b",
                  fontWeight: 900,
                }}
              >
                {modalError}
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={submitEvent}
                disabled={busy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: busy ? "#9ca3af" : "#111",
                  color: "#fff",
                  fontWeight: 950,
                }}
              >
                {busy ? "Guardando..." : "Guardar evento"}
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





