// src/app/platform/_components/PlatformBoard.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssetAvail,
  JetskiAvail,
  MonitorLite,
  MonitorRunKind,
  MonitorRunMode,
  OperabilityCountRow,
  OperabilitySummary,
  QueueItem,
  RunOpen,
} from "../types/types";
import { operabilityBadgeStyle, operabilityLabel } from "@/lib/operability-ui";
import { isAssetCompatibleWithServiceCategory } from "@/lib/platform-resource-compat";
import { opsStyles } from "@/components/ops-ui";
import PlatformAssignModal from "./PlatformAssignModal";
import PlatformAssignmentActionsModal from "./PlatformAssignmentActionsModal";
import PlatformIncidentModal from "./PlatformIncidentModal";
import PlatformResourceRadar from "./PlatformResourceRadar";
import PlatformRunCard from "./PlatformRunCard";

type Props = { title: string; kind: MonitorRunKind; categories: string[] };
const NO_RESOURCE_SELECTED = "__NONE__";
const queuedAlertMinutesRaw = Number(process.env.NEXT_PUBLIC_PLATFORM_QUEUE_ALERT_MINUTES || "15");
const QUEUED_ALERT_MINUTES = Number.isFinite(queuedAlertMinutesRaw) && queuedAlertMinutesRaw > 0 ? queuedAlertMinutesRaw : 15;
const ASSIGNED_QUEUE_WARN_MINUTES = QUEUED_ALERT_MINUTES / 2;
const ASSIGNED_QUEUE_CRITICAL_MINUTES = QUEUED_ALERT_MINUTES;

function fmtHm(d: Date) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function runModeLabel(mode: MonitorRunMode) {
  if (mode === "SOLO") return "Sin monitor";
  if (mode === "TEST") return "Modo prueba";
  return "Con monitor";
}

function getSuggestedRunForQueueItem(item: QueueItem, runs: RunOpen[]) {
  if (item.isLicense) {
    return runs.find((run) => run.mode === "SOLO") ?? runs.find((run) => run.mode === "TEST") ?? runs[0] ?? null;
  }
  return runs.find((run) => run.mode === "MONITOR") ?? runs[0] ?? null;
}

function mechanicsDetailHref(params: {
    kind: "JETSKI" | "NAUTICA";
    jetskiId?: string | null;
    assetId?: string | null;
  }) {
    if (params.kind === "JETSKI" && params.jetskiId) {
      return `/mechanics/jetski/${params.jetskiId}`;
    }

    if (params.kind === "NAUTICA" && params.assetId) {
      return `/mechanics/asset/${params.assetId}`;
    }

    return "/mechanics";
  }

  function mechanicsEventHref(params: {
    kind: "JETSKI" | "NAUTICA";
    jetskiId?: string | null;
    assetId?: string | null;
    eventId?: string | null;
  }) {
    const base =
      params.kind === "JETSKI" && params.jetskiId
        ? `/mechanics/jetski/${params.jetskiId}`
        : params.kind === "NAUTICA" && params.assetId
          ? `/mechanics/asset/${params.assetId}`
          : "/mechanics";

    if (!params.eventId) return base;

    return `${base}?eventId=${params.eventId}`;
  }

function findOperabilityCount(
  rows: OperabilityCountRow[] | undefined,
  status: OperabilityCountRow["operabilityStatus"]
) {
  return rows?.find((row) => row.operabilityStatus === status)?._count ?? 0;
}

function radarStateLabel(params: {
  operabilityStatus: string | null | undefined;
  busy: boolean;
}) {
  if (params.busy) return "Ocupada";
  return operabilityLabel(params.operabilityStatus);
}

function radarStateStyle(params: {
  operabilityStatus: string | null | undefined;
  busy: boolean;
}): React.CSSProperties {
  if (params.busy) {
    return {
      padding: "4px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      border: "1px solid #dbeafe",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  return operabilityBadgeStyle(params.operabilityStatus);
}

function applyIncidentDefaultsByLevel(
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  setters: {
    setIncidentAffectsOperability: (v: boolean) => void;
    setIncidentOperabilityStatus: (v: "" | "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE") => void;
    setIncidentCreateMaintenanceEvent: (v: boolean) => void;
  }
) {
  if (level === "LOW") {
    setters.setIncidentAffectsOperability(false);
    setters.setIncidentOperabilityStatus("OPERATIONAL");
    setters.setIncidentCreateMaintenanceEvent(false);
    return;
  }

  if (level === "MEDIUM") {
    setters.setIncidentAffectsOperability(true);
    setters.setIncidentOperabilityStatus("MAINTENANCE");
    setters.setIncidentCreateMaintenanceEvent(true);
    return;
  }

  if (level === "HIGH") {
    setters.setIncidentAffectsOperability(true);
    setters.setIncidentOperabilityStatus("DAMAGED");
    setters.setIncidentCreateMaintenanceEvent(true);
    return;
  }

  setters.setIncidentAffectsOperability(true);
  setters.setIncidentOperabilityStatus("OUT_OF_SERVICE");
  setters.setIncidentCreateMaintenanceEvent(true);
}

export default function PlatformBoard(props: Props) {
  const { title, kind, categories } = props;
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunOpen[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [jetskis, setJetskis] = useState<JetskiAvail[]>([]);
  const [assets, setAssets] = useState<AssetAvail[]>([]);
  const [monitors, setMonitors] = useState<MonitorLite[]>([]);
  const [, setTick] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<QueueItem | null>(null);
  const [assignRunId, setAssignRunId] = useState("");
  const [assignResourceId, setAssignResourceId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionAssignment, setActionAssignment] = useState<RunOpen["assignments"][0] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [createRunMode, setCreateRunMode] = useState<MonitorRunMode>("MONITOR");
  const [createRunMonitorId, setCreateRunMonitorId] = useState("");
  const [createRunResourceId, setCreateRunResourceId] = useState(NO_RESOURCE_SELECTED);
  const createRunResourceSelectRef = useRef<HTMLSelectElement | null>(null);
  const [createRunNote, setCreateRunNote] = useState("");
  const [createRunBusy, setCreateRunBusy] = useState(false);
  const [createRunError, setCreateRunError] = useState<string | null>(null);
  const [departBusyRunId, setDepartBusyRunId] = useState<string | null>(null);
  const [closeBusyRunId, setCloseBusyRunId] = useState<string | null>(null);
  const [unassignBusyAssignmentId, setUnassignBusyAssignmentId] = useState<string | null>(null);
  const [departError, setDepartError] = useState<string | null>(null);
  const [operability, setOperability] = useState<OperabilitySummary | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const [incidentType, setIncidentType] = useState<"ACCIDENT" | "DAMAGE" | "MECHANICAL" | "OTHER">("OTHER");
  const [incidentLevel, setIncidentLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("LOW");
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentNotes, setIncidentNotes] = useState("");
  const [incidentAffectsOperability, setIncidentAffectsOperability] = useState(false);
  const [incidentOperabilityStatus, setIncidentOperabilityStatus] = useState<"" | "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE">("");
  const [incidentRetainDeposit, setIncidentRetainDeposit] = useState(false);
  const [incidentRetainDepositCents, setIncidentRetainDepositCents] = useState("");
  const [incidentCreateMaintenanceEvent, setIncidentCreateMaintenanceEvent] = useState(true);
  const now = Date.now();

  async function submitIncidentFinish() {
    if (!actionAssignment) return;

    try {
      setIncidentBusy(true);
      setIncidentError(null);

      const body = {
        hasIncident: true,
        type: incidentType,
        level: incidentLevel,
        title: incidentTitle.trim() || null,
        description: incidentDescription.trim() || null,
        notes: incidentNotes.trim() || null,
        affectsOperability: incidentAffectsOperability,
        operabilityStatus: incidentAffectsOperability
          ? incidentOperabilityStatus || null
          : "OPERATIONAL",
        retainDeposit: incidentRetainDeposit,
        retainDepositCents: incidentRetainDeposit
          ? Number(incidentRetainDepositCents || "0")
          : null,
        createMaintenanceEvent: incidentCreateMaintenanceEvent,
      };

      const res = await fetch(`/api/platform/assignments/${actionAssignment.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      setIncidentOpen(false);
      setActionOpen(false);
      setActionAssignment(null);
      await loadAll();
    } catch (e: unknown) {
      setIncidentError(e instanceof Error ? e.message : "Error registrando incidencia");
    } finally {
      setIncidentBusy(false);
    }
  }

  async function createRun() {
    try {
      setCreateRunBusy(true); setCreateRunError(null);
      const selectedFromRef = createRunResourceSelectRef.current?.value ?? NO_RESOURCE_SELECTED;
      const selectedRunResourceId = createRunResourceId !== NO_RESOURCE_SELECTED ? createRunResourceId : selectedFromRef;
      if (createRunMode === "MONITOR" && !createRunMonitorId) throw new Error("Selecciona un monitor.");
      if (kind === "NAUTICA" && selectedRunResourceId === NO_RESOURCE_SELECTED) {
        if (assets.length === 0) throw new Error("No hay recursos disponibles para Náutica.");
        throw new Error("Selecciona un recurso para Náutica.");
      }
      const res = await fetch("/api/platform/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monitorId: createRunMode === "MONITOR" ? createRunMonitorId : null, kind, mode: createRunMode, monitorJetskiId: kind === "JETSKI" && selectedRunResourceId !== NO_RESOURCE_SELECTED ? selectedRunResourceId : null, monitorAssetId: kind === "NAUTICA" && selectedRunResourceId !== NO_RESOURCE_SELECTED ? selectedRunResourceId : null, note: createRunNote?.trim() ? createRunNote.trim() : null }) });
      if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(txt || "No se pudo abrir la salida."); }
      await loadAll(); setCreateRunNote(""); setCreateRunMode("MONITOR"); setCreateRunMonitorId(""); setCreateRunResourceId(NO_RESOURCE_SELECTED); if (createRunResourceSelectRef.current) createRunResourceSelectRef.current.value = NO_RESOURCE_SELECTED;
    } catch (e: unknown) { setCreateRunError(e instanceof Error ? e.message : "Error"); } finally { setCreateRunBusy(false); }
  }

  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setCreateRunMode("MONITOR"); setCreateRunMonitorId(""); setCreateRunResourceId(NO_RESOURCE_SELECTED); if (createRunResourceSelectRef.current) createRunResourceSelectRef.current.value = NO_RESOURCE_SELECTED; }, [kind]);

  const loadAll = useCallback(async (opts?: { showLoading?: boolean }) => {
    try {
      if (opts?.showLoading) setLoading(true);
      const queueParams = new URLSearchParams({ kind });
      if (categories.length > 0) {
        queueParams.set("categories", categories.join(","));
      }
      const assetsUrl =
        kind === "NAUTICA"
          ? `/api/platform/assets/available?includeBlocked=true`
          : `/api/platform/jetskis/available?includeBlocked=true`;
      const [qRes, rRes, xRes, oRes] = await Promise.all([
        fetch(`/api/platform/queue?${queueParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/platform/runs?kind=${kind}`, { cache: "no-store" }),
        fetch(assetsUrl, { cache: "no-store" }),
        fetch(`/api/platform/assets/operability`, { cache: "no-store" }),
      ]);      
      if (!qRes.ok) throw new Error(await qRes.text()); if (!rRes.ok) throw new Error(await rRes.text()); if (!xRes.ok) throw new Error(await xRes.text()); if (!oRes.ok) throw new Error(await oRes.text());
      const q = await qRes.json(); const r = await rRes.json(); const x = await xRes.json(); const o = await oRes.json();
      setOperability(o as OperabilitySummary); setQueue(q.queue ?? []); setRuns(r.runs ?? []); setMonitors(r.monitors ?? []);
      if (kind === "JETSKI") { setJetskis(x.jetskis ?? []); setAssets([]); } else { setAssets(x.assets ?? []); setJetskis([]); }
    } catch (e: unknown) { setDepartError(e instanceof Error ? e.message : "Error cargando plataforma"); } finally { if (opts?.showLoading) setLoading(false); }
  }, [kind, categories]);

  async function departRun(runId: string) {
    try { setDepartBusyRunId(runId); setDepartError(null); const res = await fetch(`/api/platform/runs/${runId}/depart`, { method: "POST", headers: { "Content-Type": "application/json" } }); if (!res.ok) throw new Error(await res.text()); await loadAll(); } catch (e: unknown) { setDepartError(e instanceof Error ? e.message : "Error iniciando salida"); } finally { setDepartBusyRunId(null); }
  }
  async function closeRun(runId: string) {
    try {
      setCloseBusyRunId(runId); setDepartError(null);
      const res = await fetch(`/api/platform/runs/${runId}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endedAt: new Date().toISOString() }) });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (e: unknown) {
      setDepartError(e instanceof Error ? e.message : "Error desasignando salida");
    } finally {
      setCloseBusyRunId(null);
    }
  }

  useEffect(() => {
    void loadAll({ showLoading: true });
    const poll = setInterval(() => {
      void loadAll();
    }, 2500);
    return () => clearInterval(poll);
  }, [loadAll]);
  const openRuns = useMemo(() => runs.filter((r) => r.status === "READY" || r.status === "IN_SEA"), [runs]);
  const readyRuns = useMemo(() => runs.filter((r) => r.status === "READY"), [runs]);
  const busyJetskis = useMemo(() => { const set = new Set<string>(); for (const run of openRuns) { if (run.monitorJetskiId) set.add(run.monitorJetskiId); for (const a of run.assignments || []) { if ((a.status === "ACTIVE" || a.status === "QUEUED") && a.jetskiId) set.add(a.jetskiId); } } return set; }, [openRuns]);
  const busyAssets = useMemo(() => { const set = new Set<string>(); for (const run of openRuns) { if (run.monitorAssetId) set.add(run.monitorAssetId); for (const a of run.assignments || []) { if ((a.status === "ACTIVE" || a.status === "QUEUED") && a.assetId) set.add(a.assetId); } } return set; }, [openRuns]);
  const assignableJetskis = useMemo(
    () =>
      jetskis.filter(
        (j) =>
          j.id &&
          !busyJetskis.has(j.id) &&
          j.operabilityStatus === "OPERATIONAL"
      ),
    [jetskis, busyJetskis]
  );

  const assignableAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.id &&
          !busyAssets.has(a.id) &&
          a.platformUsage === "CUSTOMER_ASSIGNABLE" &&
          a.operabilityStatus === "OPERATIONAL"
      ),
    [assets, busyAssets]
  );
  const runBaseAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.id &&
          !busyAssets.has(a.id) &&
          a.platformUsage !== "HIDDEN" &&
          a.operabilityStatus === "OPERATIONAL"
      ),
    [assets, busyAssets]
  );
  const blockedSummary = useMemo(() => {
    if (!operability) return null;

    return {
      jetskiMaintenance: findOperabilityCount(operability.jetskis, "MAINTENANCE"),
      jetskiDamaged: findOperabilityCount(operability.jetskis, "DAMAGED"),
      jetskiOut: findOperabilityCount(operability.jetskis, "OUT_OF_SERVICE"),
      assetMaintenance: findOperabilityCount(operability.assets, "MAINTENANCE"),
      assetDamaged: findOperabilityCount(operability.assets, "DAMAGED"),
      assetOut: findOperabilityCount(operability.assets, "OUT_OF_SERVICE"),
    };
  }, [operability]);
  const assignableCount = kind === "JETSKI" ? assignableJetskis.length : assignableAssets.length;
  const blockedCount = kind === "JETSKI"
    ? Math.max(0, jetskis.length - assignableJetskis.length)
    : Math.max(0, assets.length - assignableAssets.length);
  const assignRunOptions = useMemo(
    () =>
        readyRuns.map((run) => ({
        id: run.id,
        label: `${run.displayName} | ${run.status} | ${fmtHm(new Date(run.startedAt))}`,
      })),
    [readyRuns]
  );
  const assignResourceOptions = useMemo(
    () =>
      kind === "JETSKI"
        ? assignableJetskis.map((jetski) => ({
            id: jetski.id,
            label: `Moto ${jetski.number || "-"}`,
          }))
        : assignableAssets
            .filter((asset) =>
              isAssetCompatibleWithServiceCategory({
                assetType: asset.type,
                serviceCategory: assignTarget?.category ?? null,
              })
            )
            .map((asset) => ({
              id: asset.id,
              label: `${asset.name} · ${asset.type}`,
            })),
    [assignTarget?.category, assignableAssets, assignableJetskis, kind]
  );
  const radarItems = useMemo(
    () =>
      kind === "JETSKI"
        ? jetskis.map((jetski) => {
            const busy = busyJetskis.has(jetski.id);
            const assignable = !busy && jetski.operabilityStatus === "OPERATIONAL";

            return {
              id: jetski.id,
              title: `Moto ${jetski.number || "-"}`,
              subtitle: !assignable ? (busy ? "En salida activa" : jetski.blockReason || "No asignable") : null,
              titleHint: assignable ? "Asignable" : busy ? "Ocupada en salida" : "Bloqueada por mecánica",
              stateLabel: radarStateLabel({
                operabilityStatus: jetski.operabilityStatus,
                busy,
              }),
              stateStyle: radarStateStyle({
                operabilityStatus: jetski.operabilityStatus,
                busy,
              }),
              availabilityLabel: assignable ? "Asignable" : busy ? "En salida" : "No asignable",
              availabilityActive: assignable,
              detailHref: !assignable ? mechanicsDetailHref({ kind, jetskiId: jetski.id }) : null,
              eventHref:
                !assignable && jetski.activeMaintenanceEventId
                  ? mechanicsEventHref({
                      kind,
                      jetskiId: jetski.id,
                      eventId: jetski.activeMaintenanceEventId,
                    })
                  : null,
            };
          })
        : assets.map((asset) => {
            const busy = busyAssets.has(asset.id);
            const assignable =
              !busy &&
              asset.operabilityStatus === "OPERATIONAL" &&
              asset.platformUsage === "CUSTOMER_ASSIGNABLE";
            const usageBlockedLabel =
              asset.platformUsage === "RUN_BASE_ONLY"
                ? "Solo base de salida"
                : asset.platformUsage === "HIDDEN"
                  ? "Oculto en Platform"
                  : null;

            return {
              id: asset.id,
              title: asset.name,
              subtitle: !assignable ? (busy ? "En uso / salida activa" : usageBlockedLabel || asset.blockReason || "No asignable") : null,
              titleHint: assignable ? "Asignable" : busy ? "Ocupado en salida" : usageBlockedLabel || "Bloqueado por mecánica",
              stateLabel: radarStateLabel({
                operabilityStatus: asset.operabilityStatus,
                busy,
              }),
              stateStyle: radarStateStyle({
                operabilityStatus: asset.operabilityStatus,
                busy,
              }),
              availabilityLabel: assignable ? "Asignable" : busy ? "En uso" : usageBlockedLabel || "No asignable",
              availabilityActive: assignable,
              detailHref: !assignable ? mechanicsDetailHref({ kind, assetId: asset.id }) : null,
              eventHref:
                !assignable && asset.activeMaintenanceEventId
                  ? mechanicsEventHref({
                      kind,
                      assetId: asset.id,
                      eventId: asset.activeMaintenanceEventId,
                    })
                  : null,
            };
          }),
    [assets, busyAssets, busyJetskis, jetskis, kind]
  );
  const queuedWarnings = useMemo(() => {
    const warnMs = QUEUED_ALERT_MINUTES * 60_000;
    return queue.filter((item) => {
      if (!item.queueEnteredAt) return false;
      const entered = new Date(item.queueEnteredAt).getTime();
      return Number.isFinite(entered) && now - entered >= warnMs;
    }).length;
  }, [queue, now]);

  useEffect(() => { if (createRunResourceId === NO_RESOURCE_SELECTED) return; const exists = kind === "JETSKI" ? assignableJetskis.some((j) => j.id === createRunResourceId) : runBaseAssets.some((a) => a.id === createRunResourceId); if (!exists) setCreateRunResourceId(NO_RESOURCE_SELECTED); }, [kind, assignableJetskis, runBaseAssets, createRunResourceId]);
  useEffect(() => { if (kind === "NAUTICA" && createRunResourceId === NO_RESOURCE_SELECTED && runBaseAssets.length > 0) setCreateRunResourceId(runBaseAssets[0].id); }, [kind, runBaseAssets, createRunResourceId]);
  function openAssign(item: QueueItem) { setAssignTarget(item); setAssignOpen(true); setAssignError(null); const suggestedRun = getSuggestedRunForQueueItem(item, readyRuns); setAssignRunId(suggestedRun?.id || ""); const free = kind === "JETSKI" ? assignableJetskis[0] : assignableAssets.find((asset) => isAssetCompatibleWithServiceCategory({ assetType: asset.type, serviceCategory: item.category ?? null })); setAssignResourceId(free?.id || ""); }
  async function doAssign() {
    if (!assignTarget) return; setAssignError(null); if (!assignRunId) return setAssignError("Selecciona un monitor o salida."); if (!assignResourceId) return setAssignError(kind === "JETSKI" ? "Selecciona una moto." : "Selecciona un recurso.");
    setAssignBusy(true);
    try { const body = kind === "JETSKI" ? { reservationUnitId: assignTarget.reservationUnitId ?? "", jetskiId: assignResourceId } : { reservationUnitId: assignTarget.reservationUnitId ?? "", assetId: assignResourceId }; const res = await fetch(`/api/platform/runs/${assignRunId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!res.ok) throw new Error(await res.text()); setAssignOpen(false); setAssignTarget(null); await loadAll(); } catch (e: unknown) { setAssignError(e instanceof Error ? e.message : "Error asignando"); } finally { setAssignBusy(false); }
  }
  function openAssignmentActions(a: RunOpen["assignments"][0]) { setActionAssignment(a); setActionOpen(true); setActionError(null); }
  function openIncidentFlow() {
    setIncidentType("OTHER");
    setIncidentLevel("LOW");
    setIncidentTitle("");
    setIncidentDescription("");
    setIncidentNotes("");
    setIncidentAffectsOperability(false);
    setIncidentOperabilityStatus("OPERATIONAL");
    setIncidentRetainDeposit(false);
    setIncidentRetainDepositCents("");
    setIncidentCreateMaintenanceEvent(false);
    setIncidentError(null);
    setIncidentOpen(true);
  }
  async function finishAssignment(hasIncident: boolean) { if (!actionAssignment) return; setActionBusy(true); setActionError(null); try { const res = await fetch(`/api/platform/assignments/${actionAssignment.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hasIncident, type: hasIncident ? "OTHER" : undefined, level: hasIncident ? "LOW" : undefined }) }); if (!res.ok) throw new Error(await res.text()); setActionOpen(false); setActionAssignment(null); await loadAll(); } catch (e: unknown) { setActionError(e instanceof Error ? e.message : "Error finalizando"); } finally { setActionBusy(false); } }
  async function extendAssignment(extraMinutes: number, serviceCode: string) { if (!actionAssignment) return; setActionBusy(true); setActionError(null); try { const res = await fetch(`/api/platform/assignments/${actionAssignment.id}/extend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraMinutes, serviceCode }) }); if (!res.ok) throw new Error(await res.text()); setActionOpen(false); setActionAssignment(null); await loadAll(); } catch (e: unknown) { setActionError(e instanceof Error ? e.message : "Error extendiendo tiempo"); } finally { setActionBusy(false); } }
  async function unassignAssignment(assignmentId: string) {
    try {
      setUnassignBusyAssignmentId(assignmentId);
      setDepartError(null);
      const res = await fetch(`/api/platform/assignments/${assignmentId}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (e: unknown) {
      setDepartError(e instanceof Error ? e.message : "Error desasignando cliente");
    } finally {
      setUnassignBusyAssignmentId(null);
    }
  }

  return (
    <div style={{ width: "min(1600px, 100%)", padding: "clamp(16px, 3vw, 28px)", margin: "0 auto", display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 16, padding: "clamp(20px, 3vw, 24px)", border: "1px solid #dbe4ea", borderRadius: 24, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #e0f2fe 100%)", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0369a1" }}>Board en vivo</div><div style={{ fontSize: "clamp(28px, 4vw, 34px)", fontWeight: 950, lineHeight: 1, marginTop: 6 }}>{title}</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Monitores, recursos, cola operativa y temporizadores de salida en tiempo real.</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, width: "min(100%, 360px)" }}>
          <a href="/operations" style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d9e4", textDecoration: "none", color: "#111", background: "#fff", fontWeight: 900, textAlign: "center" }}>Centro de Operaciones</a>
          <button type="button" onClick={() => loadAll({ showLoading: true })} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900, width: "100%" }}>Refrescar</button>
        </div>
      </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div style={metricCardStyle}><div style={metricLabelStyle}>En cola</div><div style={metricValueStyle}>{queue.length}</div></div>
          <div style={metricCardStyle}><div style={metricLabelStyle}>Salidas abiertas</div><div style={metricValueStyle}>{openRuns.length}</div></div>
          <div style={metricCardStyle}><div style={metricLabelStyle}>Asignables</div><div style={metricValueStyle}>{assignableCount}</div></div>
          <div style={metricCardStyle}><div style={metricLabelStyle}>Bloqueados / ocupados</div><div style={metricValueStyle}>{blockedCount}</div></div>
          <div style={metricCardStyle}><div style={metricLabelStyle}>Alertas de espera</div><div style={metricValueStyle}>{queuedWarnings}</div></div>
        </div>
      </div>

      {blockedSummary &&
        (blockedSummary.jetskiMaintenance +
          blockedSummary.jetskiDamaged +
          blockedSummary.jetskiOut +
          blockedSummary.assetMaintenance +
          blockedSummary.assetDamaged +
          blockedSummary.assetOut) > 0 && (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              fontWeight: 900,
              display: "grid",
              gap: 10,
            }}
          >
            <div>Estado mecánico</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, max-content))", gap: 8 }}>
              {blockedSummary.jetskiMaintenance > 0 ? (
                <div style={operabilityBadgeStyle("MAINTENANCE")}>
                  {blockedSummary.jetskiMaintenance} motos en mantenimiento
                </div>
              ) : null}
              {blockedSummary.jetskiDamaged > 0 ? (
                <div style={operabilityBadgeStyle("DAMAGED")}>
                  {blockedSummary.jetskiDamaged} motos dañadas
                </div>
              ) : null}
              {blockedSummary.jetskiOut > 0 ? (
                <div style={operabilityBadgeStyle("OUT_OF_SERVICE")}>
                  {blockedSummary.jetskiOut} motos fuera de servicio
                </div>
              ) : null}
              {blockedSummary.assetMaintenance > 0 ? (
                <div style={operabilityBadgeStyle("MAINTENANCE")}>
                  {blockedSummary.assetMaintenance} recursos en mantenimiento
                </div>
              ) : null}
              {blockedSummary.assetDamaged > 0 ? (
                <div style={operabilityBadgeStyle("DAMAGED")}>
                  {blockedSummary.assetDamaged} recursos dañados
                </div>
              ) : null}
              {blockedSummary.assetOut > 0 ? (
                <div style={operabilityBadgeStyle("OUT_OF_SERVICE")}>
                  {blockedSummary.assetOut} recursos fuera de servicio
                </div>
              ) : null}
            </div>
          </div>
        )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        {departError ? <div style={{ gridColumn: "1 / -1", padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>{departError}</div> : null}

        <div style={{ border: "1px solid #dbe4ea", borderRadius: 22, background: "#fff", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}><div style={{ fontWeight: 950 }}>Cola</div><div style={{ fontWeight: 900, opacity: 0.8 }}>{queue.length}</div></div>
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
            {queue.length === 0 && !loading ? <div style={{ opacity: 0.7 }}>No hay reservas listas.</div> : null}
            {queue.map((q, idx) => {
              const queueAtMs = q.queueEnteredAt ? new Date(q.queueEnteredAt).getTime() : null;
              const queueWaitMs = queueAtMs ? Math.max(0, now - queueAtMs) : null;
              const queueWarnMs = QUEUED_ALERT_MINUTES * 60_000;
              const queueIsWarn = queueWaitMs !== null && queueWaitMs >= queueWarnMs;
              const queueIsCritical = queueWaitMs !== null && queueWaitMs >= queueWarnMs * 2;
              const queueBd = queueIsCritical ? "#fecaca" : queueIsWarn ? "#fde68a" : "#eee";
              const queueBg = queueIsCritical ? "#fff1f2" : queueIsWarn ? "#fffbeb" : "#fff";
              const queueFg = queueIsCritical ? "#b91c1c" : queueIsWarn ? "#92400e" : "#111";
              return <div key={`${q.reservationId}-${q.reservationUnitId || idx}`} style={{ border: `1px solid ${queueBd}`, background: queueBg, borderRadius: 18, padding: 14, display: "grid", gap: 8, boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ fontWeight: 950 }}>{q.customerName || "Sin nombre"}{q.reservationUnitId ? <span style={{ opacity: 0.7 }}> | Unidad</span> : null}</div><div style={{ fontSize: 12, fontWeight: 900, color: queueFg }}>{queueWaitMs !== null ? `Espera ${msToClock(queueWaitMs)}` : q.durationMinutes ? `${q.durationMinutes} min` : q.label || ""}</div></div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{q.category ? `${q.category} | ` : ""}{q.serviceName || "Servicio"}{q.isLicense ? " | Licencia" : ""}</div>
                {q.isLicense ? <div style={{ fontSize: 12, fontWeight: 900, color: "#0369a1" }}>Sugerencia: asignar a salida sin monitor.</div> : null}
                {queueWaitMs !== null ? <div style={{ display: "grid", gap: 6 }}><div style={{ position: "relative", height: 10, borderRadius: 999, background: queueIsCritical ? "#fee2e2" : queueIsWarn ? "#fef3c7" : "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${Math.min(100, (queueWaitMs / (queueWarnMs * 2)) * 100)}%`, height: "100%", background: queueIsCritical ? "#dc2626" : queueIsWarn ? "#f59e0b" : "#0f172a" }} /></div><div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: queueFg, fontWeight: 800 }}><span>Entrada</span><span>{QUEUED_ALERT_MINUTES} min</span><span>{QUEUED_ALERT_MINUTES * 2} min</span></div></div> : null}
                {queueWaitMs !== null ? <div style={{ fontSize: 12, color: queueFg, fontWeight: queueIsWarn ? 800 : 600 }}>{queueIsCritical ? `ALERTA CRITICA (${QUEUED_ALERT_MINUTES * 2}+ min)` : queueIsWarn ? `Alerta de espera (${QUEUED_ALERT_MINUTES}+ min)` : `En cola desde ${fmtHm(new Date(queueAtMs!))}`}</div> : null}
                <button type="button" onClick={() => openAssign(q)} disabled={readyRuns.length === 0} title={readyRuns.length > 0 ? (q.isLicense ? "Sugerencia: salida sin monitor" : "Asignar a una salida READY") : (q.isLicense ? "Primero abre una salida READY, sugerencia: Sin monitor" : "Primero abre una salida READY")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: readyRuns.length === 0 ? "#9ca3af" : "#111", color: "#fff", fontWeight: 950, cursor: readyRuns.length === 0 ? "not-allowed" : "pointer" }}>Asignar</button>
              </div>;
            })}
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ea", borderRadius: 22, background: "#fff", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}><div style={{ fontWeight: 950 }}>Salidas</div><div style={{ fontSize: 12, opacity: 0.75 }}>{openRuns.length} salidas abiertas</div></div>
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            {openRuns.length === 0 ? <div style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 12, border: "1px solid #fde68a", background: "#fffbeb", fontWeight: 900 }}>No hay salidas abiertas. Abre una salida en este panel y vuelve aquí.</div> : null}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>Abrir salida</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Modo<select value={createRunMode} onChange={(e) => setCreateRunMode(e.target.value as MonitorRunMode)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }}><option value="MONITOR">Con monitor</option><option value="SOLO">Sin monitor</option><option value="TEST">Modo prueba</option></select></label>
                {createRunMode === "MONITOR" ? <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Monitor<select value={createRunMonitorId} onChange={(e) => setCreateRunMonitorId(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }}><option value="">Selecciona...</option>{monitors.map((m: MonitorLite) => <option key={m.id} value={m.id}>{m.name} | cap {m.maxCapacity || 4}</option>)}</select></label> : <div style={{ display: "grid", gap: 6, fontSize: 13 }}><div>Modo seleccionado</div><div style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}>{runModeLabel(createRunMode)}</div></div>}
                <select ref={createRunResourceSelectRef} value={createRunResourceId} onChange={(e) => setCreateRunResourceId(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }}><option value={NO_RESOURCE_SELECTED}>{kind === "JETSKI" ? "Sin moto fija" : "Selecciona recurso..."}</option>{kind === "JETSKI"
                  ? assignableJetskis.map((j) => (
                      <option key={j.id} value={j.id}>
                        {`Moto ${j.number ?? "-"}`}
                      </option>
                    ))
                  : runBaseAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {`${a.name}${a.platformUsage === "RUN_BASE_ONLY" ? " · SOLO BASE" : ""}`}
                      </option>
                    ))}</select>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Nota opcional<input value={createRunNote} onChange={(e) => setCreateRunNote(e.target.value)} placeholder={createRunMode === "TEST" ? "Ej: prueba tras reparación / revisión..." : createRunMode === "SOLO" ? "Ej: licencia sin monitor..." : "Ej: grupo escuela / incidencia previa..."} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }} /></label>
              </div>
              {createRunError ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>{createRunError}</div> : null}
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}><button type="button" onClick={createRun} disabled={createRunBusy} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: createRunBusy ? "#9ca3af" : "#111", color: "#fff", fontWeight: 950, width: "100%" }}>{createRunBusy ? "Abriendo..." : "Abrir salida"}</button></div>
            </div>
            {openRuns.map((run) => (
              <PlatformRunCard
                key={run.id}
                run={run}
                kind={kind}
                now={now}
                assignedQueueWarnMinutes={ASSIGNED_QUEUE_WARN_MINUTES}
                assignedQueueCriticalMinutes={ASSIGNED_QUEUE_CRITICAL_MINUTES}
                departBusy={departBusyRunId === run.id}
                closeBusy={closeBusyRunId === run.id}
                unassignBusyAssignmentId={unassignBusyAssignmentId}
                onDepartRun={departRun}
                onCloseRun={closeRun}
                onOpenAssignmentActions={openAssignmentActions}
                onUnassignAssignment={unassignAssignment}
              />
            ))}
          </div>
        </div>

      <PlatformResourceRadar
          title={kind === "JETSKI" ? "Radar de motos" : "Radar de recursos"}
          count={kind === "JETSKI" ? jetskis.length : assets.length}
          emptyLabel={kind === "JETSKI" ? "No hay motos registradas en radar." : "No hay recursos registrados en radar."}
          loading={loading}
          items={radarItems}
        />
      </div>
      <PlatformAssignModal
        open={assignOpen}
        busy={assignBusy}
        error={assignError}
        kind={kind}
        target={assignTarget}
        runId={assignRunId}
        resourceId={assignResourceId}
        runOptions={assignRunOptions}
        resourceOptions={assignResourceOptions}
        onClose={() => setAssignOpen(false)}
        onRunChange={setAssignRunId}
        onResourceChange={setAssignResourceId}
        onSubmit={doAssign}
      />
      <PlatformAssignmentActionsModal
        open={actionOpen}
        busy={actionBusy}
        error={actionError}
        assignment={actionAssignment}
        expectedEndLabel={actionAssignment?.expectedEndAt ? fmtHm(new Date(actionAssignment.expectedEndAt)) : "- pendiente de salida -"}
        onClose={() => setActionOpen(false)}
        onFinishWithoutIncident={() => finishAssignment(false)}
        onFinishWithIncident={openIncidentFlow}
        onExtend={extendAssignment}
      />
    
      <PlatformIncidentModal
        open={incidentOpen}
        busy={incidentBusy}
        error={incidentError}
        kind={kind}
        assignment={actionAssignment}
        incidentType={incidentType}
        incidentLevel={incidentLevel}
        incidentTitle={incidentTitle}
        incidentDescription={incidentDescription}
        incidentNotes={incidentNotes}
        incidentAffectsOperability={incidentAffectsOperability}
        incidentOperabilityStatus={incidentOperabilityStatus}
        incidentRetainDeposit={incidentRetainDeposit}
        incidentRetainDepositCents={incidentRetainDepositCents}
        incidentCreateMaintenanceEvent={incidentCreateMaintenanceEvent}
        onClose={() => setIncidentOpen(false)}
        onSubmit={submitIncidentFinish}
        onIncidentTypeChange={setIncidentType}
        onIncidentLevelChange={(next) => {
          setIncidentLevel(next);
          applyIncidentDefaultsByLevel(next, {
            setIncidentAffectsOperability,
            setIncidentOperabilityStatus,
            setIncidentCreateMaintenanceEvent,
          });
        }}
        onIncidentTitleChange={setIncidentTitle}
        onIncidentDescriptionChange={setIncidentDescription}
        onIncidentNotesChange={setIncidentNotes}
        onIncidentAffectsOperabilityChange={setIncidentAffectsOperability}
        onIncidentOperabilityStatusChange={setIncidentOperabilityStatus}
        onIncidentRetainDepositChange={setIncidentRetainDeposit}
        onIncidentRetainDepositCentsChange={setIncidentRetainDepositCents}
        onIncidentCreateMaintenanceEventChange={setIncidentCreateMaintenanceEvent}
      />
    </div>
  );
}

const metricCardStyle: React.CSSProperties = {
  ...opsStyles.metricCard,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 950,
  color: "#0f172a",
};
