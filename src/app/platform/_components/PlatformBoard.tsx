// src/app/platform/_components/PlatformBoard.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssetAvail,
  JetskiAvail,
  MonitorLite,
  MonitorRunKind,
  OperabilityCountRow,
  OperabilitySummary,
  QueueItem,
  RunOpen,
} from "../types/types";
import { operabilityBadgeStyle, operabilityLabel } from "@/lib/operability-ui";
import Link from "next/link";

type Props = { title: string; kind: MonitorRunKind; categories: string[] };
const NO_RESOURCE_SELECTED = "__NONE__";
const queuedAlertMinutesRaw = Number(process.env.NEXT_PUBLIC_PLATFORM_QUEUE_ALERT_MINUTES || "15");
const QUEUED_ALERT_MINUTES = Number.isFinite(queuedAlertMinutesRaw) && queuedAlertMinutesRaw > 0 ? queuedAlertMinutesRaw : 15;
const ASSIGNED_QUEUE_WARN_MINUTES = QUEUED_ALERT_MINUTES / 2;
const ASSIGNED_QUEUE_CRITICAL_MINUTES = QUEUED_ALERT_MINUTES;

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function fmtHm(d: Date) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function clsTimer(msLeft: number) {
  if (msLeft <= 0) return { bg: "#fff1f2", bd: "#fecaca", fg: "#b91c1c" };
  if (msLeft <= 5 * 60 * 1000) return { bg: "#fffbeb", bd: "#fde68a", fg: "#b45309" };
  return { bg: "#ecfdf5", bd: "#a7f3d0", fg: "#065f46" };
}
function timerLabel(msLeft: number | null) { if (msLeft === null) return ""; if (msLeft <= 0) return `+${msToClock(Math.abs(msLeft))}`; return msToClock(msLeft); }
function progressTone(progress: number, msLeft: number) {
  if (msLeft <= 0) return { fill: "#dc2626", track: "#fee2e2", text: "#991b1b" };
  if (msLeft <= 5 * 60 * 1000) return { fill: "#f59e0b", track: "#fef3c7", text: "#92400e" };
  if (progress >= 0.75) return { fill: "#0f766e", track: "#ccfbf1", text: "#115e59" };
  return { fill: "#0f172a", track: "#dbeafe", text: "#1e3a8a" };
}
function TimelineBar({ progress, msLeft }: { progress: number; msLeft: number }) {
  const p = clamp(progress, 0, 1);
  const tone = progressTone(p, msLeft);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ position: "relative", height: 12, borderRadius: 999, background: tone.track, overflow: "hidden", border: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, p * 100))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${tone.fill} 0%, ${tone.fill}cc 100%)`, transition: "width 0.4s ease" }} />
        {[25, 50, 75].map((mark) => <div key={mark} style={{ position: "absolute", left: `${mark}%`, top: 0, bottom: 0, width: 1, background: "rgba(15, 23, 42, 0.18)" }} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#64748b", fontWeight: 800 }}><span>Salida</span><span>25%</span><span>50%</span><span>75%</span><span>Fin</span></div>
    </div>
  );
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
      if (!createRunMonitorId) throw new Error("Selecciona un monitor.");
      if (kind === "NAUTICA" && selectedRunResourceId === NO_RESOURCE_SELECTED) {
        if (assets.length === 0) throw new Error("No hay recursos disponibles para Náutica.");
        throw new Error("Selecciona un recurso para Náutica.");
      }
      const res = await fetch("/api/platform/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monitorId: createRunMonitorId, kind, monitorJetskiId: kind === "JETSKI" && selectedRunResourceId !== NO_RESOURCE_SELECTED ? selectedRunResourceId : null, monitorAssetId: kind === "NAUTICA" && selectedRunResourceId !== NO_RESOURCE_SELECTED ? selectedRunResourceId : null, note: createRunNote?.trim() ? createRunNote.trim() : null }) });
      if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(txt || "No se pudo abrir la salida."); }
      await loadAll(); setCreateRunNote(""); setCreateRunResourceId(NO_RESOURCE_SELECTED); if (createRunResourceSelectRef.current) createRunResourceSelectRef.current.value = NO_RESOURCE_SELECTED;
    } catch (e: unknown) { setCreateRunError(e instanceof Error ? e.message : "Error"); } finally { setCreateRunBusy(false); }
  }

  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setCreateRunResourceId(NO_RESOURCE_SELECTED); if (createRunResourceSelectRef.current) createRunResourceSelectRef.current.value = NO_RESOURCE_SELECTED; }, [kind]);

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

  useEffect(() => { void loadAll({ showLoading: true }); const poll = setInterval(() => { void loadAll(); }, 2500); return () => clearInterval(poll); }, [loadAll]);
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
  const queuedWarnings = useMemo(() => {
    const warnMs = QUEUED_ALERT_MINUTES * 60_000;
    return queue.filter((item) => {
      if (!item.queueEnteredAt) return false;
      const entered = new Date(item.queueEnteredAt).getTime();
      return Number.isFinite(entered) && now - entered >= warnMs;
    }).length;
  }, [queue, now]);

  useEffect(() => { if (createRunResourceId === NO_RESOURCE_SELECTED) return; const exists = kind === "JETSKI" ? jetskis.some((j) => j.id === createRunResourceId) : assets.some((a) => a.id === createRunResourceId); if (!exists) setCreateRunResourceId(NO_RESOURCE_SELECTED); }, [kind, jetskis, assets, createRunResourceId]);
  useEffect(() => { if (kind === "NAUTICA" && createRunResourceId === NO_RESOURCE_SELECTED && assets.length > 0) setCreateRunResourceId(assets[0].id); }, [kind, assets, createRunResourceId]);
  function openAssign(item: QueueItem) { setAssignTarget(item); setAssignOpen(true); setAssignError(null); setAssignRunId(readyRuns[0]?.id || ""); const free = kind === "JETSKI" ? assignableJetskis[0] : assignableAssets[0]; setAssignResourceId(free?.id || ""); }
  async function doAssign() {
    if (!assignTarget) return; setAssignError(null); if (!assignRunId) return setAssignError("Selecciona un monitor o salida."); if (!assignResourceId) return setAssignError(kind === "JETSKI" ? "Selecciona una moto." : "Selecciona un recurso.");
    setAssignBusy(true);
    try { const body = kind === "JETSKI" ? { reservationUnitId: assignTarget.reservationUnitId ?? "", jetskiId: assignResourceId } : { reservationUnitId: assignTarget.reservationUnitId ?? "", assetId: assignResourceId }; const res = await fetch(`/api/platform/runs/${assignRunId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!res.ok) throw new Error(await res.text()); setAssignOpen(false); setAssignTarget(null); await loadAll(); } catch (e: unknown) { setAssignError(e instanceof Error ? e.message : "Error asignando"); } finally { setAssignBusy(false); }
  }
  function openAssignmentActions(a: RunOpen["assignments"][0]) { setActionAssignment(a); setActionOpen(true); setActionError(null); }
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
    <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, padding: 22, border: "1px solid #dbe4ea", borderRadius: 24, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #e0f2fe 100%)", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0369a1" }}>Board en vivo</div><div style={{ fontSize: 30, fontWeight: 950, lineHeight: 1, marginTop: 6 }}>{title}</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Monitores, recursos, cola operativa y temporizadores de salida en tiempo real.</div></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/operations" style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d9e4", textDecoration: "none", color: "#111", background: "#fff", fontWeight: 900 }}>Centro de Operaciones</a>
          <button type="button" onClick={() => loadAll({ showLoading: true })} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 }}>Refrescar</button>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.1fr) minmax(520px, 2fr) minmax(260px, 1fr)", gap: 16, alignItems: "start" }}>
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
                <div style={{ fontSize: 12, opacity: 0.8 }}>{q.category ? `${q.category} | ` : ""}{q.serviceName || "Servicio"}</div>
                {queueWaitMs !== null ? <div style={{ display: "grid", gap: 6 }}><div style={{ position: "relative", height: 10, borderRadius: 999, background: queueIsCritical ? "#fee2e2" : queueIsWarn ? "#fef3c7" : "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${Math.min(100, (queueWaitMs / (queueWarnMs * 2)) * 100)}%`, height: "100%", background: queueIsCritical ? "#dc2626" : queueIsWarn ? "#f59e0b" : "#0f172a" }} /></div><div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: queueFg, fontWeight: 800 }}><span>Entrada</span><span>{QUEUED_ALERT_MINUTES} min</span><span>{QUEUED_ALERT_MINUTES * 2} min</span></div></div> : null}
                {queueWaitMs !== null ? <div style={{ fontSize: 12, color: queueFg, fontWeight: queueIsWarn ? 800 : 600 }}>{queueIsCritical ? `ALERTA CRITICA (${QUEUED_ALERT_MINUTES * 2}+ min)` : queueIsWarn ? `Alerta de espera (${QUEUED_ALERT_MINUTES}+ min)` : `En cola desde ${fmtHm(new Date(queueAtMs!))}`}</div> : null}
                <button type="button" onClick={() => openAssign(q)} disabled={readyRuns.length === 0} title={readyRuns.length > 0 ? "Asignar a una salida READY" : "Primero abre una salida READY"} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: readyRuns.length === 0 ? "#9ca3af" : "#111", color: "#fff", fontWeight: 950, cursor: readyRuns.length === 0 ? "not-allowed" : "pointer" }}>Asignar</button>
              </div>;
            })}
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ea", borderRadius: 22, background: "#fff", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}><div style={{ fontWeight: 950 }}>Monitores</div><div style={{ fontSize: 12, opacity: 0.75 }}>{openRuns.length} salidas abiertas</div></div>
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            {openRuns.length === 0 ? <div style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 12, border: "1px solid #fde68a", background: "#fffbeb", fontWeight: 900 }}>No hay salidas abiertas. Abre una salida en el panel de monitores y vuelve aquí.</div> : null}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>Abrir salida por monitor</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Monitor<select value={createRunMonitorId} onChange={(e) => setCreateRunMonitorId(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }}><option value="">Selecciona...</option>{monitors.map((m: MonitorLite) => <option key={m.id} value={m.id}>{m.name} | cap {m.maxCapacity || 4}</option>)}</select></label>
                <select ref={createRunResourceSelectRef} value={createRunResourceId} onChange={(e) => setCreateRunResourceId(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }}><option value={NO_RESOURCE_SELECTED}>{kind === "JETSKI" ? "Sin moto fija" : "Selecciona recurso..."}</option>{kind === "JETSKI"
                  ? jetskis.map((j) => (
                      <option key={j.id} value={j.id}>
                        {`Moto ${j.number ?? "-"}`}
                      </option>
                    ))
                  : assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}</select>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Nota opcional<input value={createRunNote} onChange={(e) => setCreateRunNote(e.target.value)} placeholder="Ej: grupo escuela / incidencia previa..." style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d9e4" }} /></label>
              </div>
              {createRunError ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>{createRunError}</div> : null}
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={createRun} disabled={createRunBusy} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: createRunBusy ? "#9ca3af" : "#111", color: "#fff", fontWeight: 950 }}>{createRunBusy ? "Abriendo..." : "Abrir salida"}</button></div>
            </div>
            {openRuns.map((run) => <div key={run.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
              {(() => {
                const hasActiveOrQueuedAssignments = (run.assignments || []).some((a) => a.status === "ACTIVE" || a.status === "QUEUED");
                const canCloseRun =
                  (run.status === "READY" || run.status === "IN_SEA") &&
                  !hasActiveOrQueuedAssignments;
                return (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}><div style={{ fontWeight: 950, fontSize: 18 }}>{run.monitor?.name || "Monitor"}</div><div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #e5e7eb", fontWeight: 900, fontSize: 12, background: run.status === "IN_SEA" ? "#ecfeff" : "#f8fafc" }}>{run.status}</div><div style={{ fontSize: 12, opacity: 0.8 }}>Salida iniciada: <b>{fmtHm(new Date(run.startedAt))}</b></div>{run.monitorJetski ? <div style={{ fontSize: 12, opacity: 0.85 }}>Moto monitor: <b>#{run.monitorJetski.number || "-"}</b></div> : null}{run.monitorAsset ? <div style={{ fontSize: 12, opacity: 0.85 }}>Recurso monitor: <b>{run.monitorAsset.name}</b></div> : null}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => departRun(run.id)} disabled={run.status !== "READY" || departBusyRunId === run.id || closeBusyRunId === run.id} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111", background: run.status !== "READY" || departBusyRunId === run.id || closeBusyRunId === run.id ? "#9ca3af" : "#111", color: "#fff", fontWeight: 900, cursor: run.status !== "READY" || departBusyRunId === run.id || closeBusyRunId === run.id ? "not-allowed" : "pointer" }}>{departBusyRunId === run.id ? "Iniciando..." : "Iniciar salida"}</button>
                  <button type="button" onClick={() => closeRun(run.id)} disabled={!canCloseRun || closeBusyRunId === run.id || departBusyRunId === run.id} title={canCloseRun ? "Cerrar salida y liberar monitor/recurso" : "Solo disponible en READY/IN_SEA y sin clientes asignados"} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dc2626", background: !canCloseRun || closeBusyRunId === run.id || departBusyRunId === run.id ? "#fecaca" : "#fff", color: "#991b1b", fontWeight: 900, cursor: !canCloseRun || closeBusyRunId === run.id || departBusyRunId === run.id ? "not-allowed" : "pointer" }}>{closeBusyRunId === run.id ? "Desasignando..." : "Desasignar"}</button>
                  {run.note ? <div style={{ fontSize: 12, opacity: 0.8 }}>Nota: {run.note}</div> : null}
                </div>
              </div>
                );
              })()}
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {(run.assignments || []).filter((a) => a.status === "ACTIVE" || a.status === "QUEUED").map((a) => {
                  const isQueued = a.status === "QUEUED";
                  const canUnassign = run.status !== "IN_SEA" || isQueued;
                  const queuedAtMs = a.createdAt ? new Date(a.createdAt).getTime() : null;
                  const queuedWaitMs = isQueued && queuedAtMs ? Math.max(0, now - queuedAtMs) : null;
                  const queuedWarnMs = ASSIGNED_QUEUE_WARN_MINUTES * 60_000;
                  const queuedCriticalMs = ASSIGNED_QUEUE_CRITICAL_MINUTES * 60_000;
                  const queuedIsWarn = isQueued && queuedWaitMs !== null && queuedWaitMs >= queuedWarnMs;
                  const queuedIsCritical = isQueued && queuedWaitMs !== null && queuedWaitMs >= queuedCriticalMs;
                  const startMs = a.startedAt ? new Date(a.startedAt).getTime() : null;
                  const endMs = a.expectedEndAt ? new Date(a.expectedEndAt).getTime() : null;
                  const hasTimes = !isQueued && startMs !== null && endMs !== null;
                  const totalMs = hasTimes ? Math.max(1, endMs - startMs) : 1;
                  const elapsedMs = hasTimes ? clamp(now - startMs, 0, totalMs) : 0;
                  const msLeft = hasTimes ? endMs - now : null;
                  const progress = hasTimes ? elapsedMs / totalMs : 0;
                  const colors = hasTimes ? clsTimer(msLeft || 0) : queuedIsCritical ? { bd: "#fecaca", bg: "#fff1f2", fg: "#b91c1c" } : queuedIsWarn ? { bd: "#fde68a", bg: "#fffbeb", fg: "#92400e" } : { bd: "#e5e7eb", bg: "#f9fafb", fg: "#111" };
                  const customer = a.reservation?.customerName || "Cliente";
                  const resourceLabel = kind === "JETSKI" ? (a.jetski?.number ? `Moto ${a.jetski.number}` : "Moto") : a.asset?.name || "Recurso";
                  const mins = a.durationMinutesSnapshot || null;
                  return <div key={a.id} style={{ border: `1px solid ${colors.bd}`, background: colors.bg, borderRadius: 18, padding: 14, display: "grid", gap: 10, boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950 }}>{customer}<span style={{ opacity: 0.75 }}> | {resourceLabel}</span>{mins ? <span style={{ opacity: 0.75 }}> | {mins} min</span> : null}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div style={{ padding: "4px 10px", borderRadius: 999, background: "#ffffffaa", border: `1px solid ${colors.bd}`, fontSize: 12, fontWeight: 900, color: colors.fg }}>{isQueued ? "QUEUE" : msLeft !== null && msLeft <= 0 ? "EXTRA" : "EN CURSO"}</div><div style={{ fontWeight: 950, color: colors.fg, fontSize: 20 }}>{isQueued ? `Pendiente${queuedWaitMs !== null ? ` | ${msToClock(queuedWaitMs)}` : ""}` : msLeft !== null ? `${timerLabel(msLeft)} ${msLeft <= 0 ? "extra" : "restantes"}` : ""}</div></div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.85 }}>{hasTimes ? <><div>Inicio: {fmtHm(new Date(startMs!))}</div><div>Fin: {fmtHm(new Date(endMs!))}</div></> : <div>Aún no ha iniciado la salida{queuedWaitMs !== null && queuedAtMs ? ` | en cola desde ${fmtHm(new Date(queuedAtMs))}` : ""}{queuedIsCritical ? ` | ALERTA CRITICA (${ASSIGNED_QUEUE_CRITICAL_MINUTES}+ min)` : queuedIsWarn ? ` | Alerta de espera (${ASSIGNED_QUEUE_WARN_MINUTES}+ min)` : ""}</div>}</div>
                    {hasTimes ? <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: "#ffffffaa", border: `1px solid ${colors.bd}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 12, fontWeight: 900, color: colors.fg }}>Progreso temporal</div><div style={{ fontSize: 12, color: colors.fg, fontWeight: 900 }}>{Math.round(progress * 100)}%</div></div><TimelineBar progress={progress} msLeft={msLeft ?? 0} /><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#475569" }}><span>Inicio: <b>{fmtHm(new Date(startMs!))}</b></span><span>Fin previsto: <b>{fmtHm(new Date(endMs!))}</b></span></div></div> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <button type="button" onClick={() => openAssignmentActions(a)} disabled={isQueued} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111", background: isQueued ? "#f3f4f6" : "#fff", opacity: isQueued ? 0.6 : 1, fontWeight: 900, cursor: isQueued ? "not-allowed" : "pointer" }}>Acciones</button>
                      <button
                        type="button"
                        onClick={() => unassignAssignment(a.id)}
                        disabled={!canUnassign || unassignBusyAssignmentId === a.id}
                        title={canUnassign ? "Quitar cliente de la salida y devolverlo a cola" : "No se puede desasignar un cliente activo en IN_SEA"}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #dc2626",
                          background: !canUnassign || unassignBusyAssignmentId === a.id ? "#fecaca" : "#fff",
                          color: "#991b1b",
                          fontWeight: 900,
                          cursor: !canUnassign || unassignBusyAssignmentId === a.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {unassignBusyAssignmentId === a.id ? "Desasignando..." : "Desasignar cliente"}
                      </button>
                    </div>
                  </div>;
                })}
                {(run.assignments || []).filter((a) => a.status === "ACTIVE" || a.status === "QUEUED").length === 0 ? <div style={{ opacity: 0.7, fontSize: 13 }}>No hay clientes activos o pendientes en esta salida.</div> : null}
              </div>
            </div>)}
          </div>
        </div>

        <div style={{ border: "1px solid #dbe4ea", borderRadius: 22, background: "#fff", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", background: "#f8fafc" }}>
            <div style={{ fontWeight: 950 }}>{kind === "JETSKI" ? "Radar de motos" : "Radar de recursos"}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {kind === "JETSKI" ? jetskis.length : assets.length} en radar
            </div>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            {kind === "JETSKI" && jetskis.length === 0 && !loading ? (
              <div style={{ opacity: 0.7 }}>No hay motos registradas en radar.</div>
            ) : null}

            {kind === "NAUTICA" && assets.length === 0 && !loading ? (
              <div style={{ opacity: 0.7 }}>No hay recursos registrados en radar.</div>
            ) : null}
            {kind === "JETSKI"
              ? jetskis.map((j) => {
                  const busy = busyJetskis.has(j.id);
                  const assignable = !busy && j.operabilityStatus === "OPERATIONAL";

                  return (
                    <div
                      key={j.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 16,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        opacity: assignable ? 1 : 0.92,
                      }}
                      title={assignable ? "Asignable" : busy ? "Ocupada en salida" : "Bloqueada por mecánica"}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 950 }}>Moto {j.number || "-"}</div>
                        
                        {!assignable ? (
                        <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                          {busy ? "En salida activa" : j.blockReason || "No asignable"}
                        </div>
                      ) : null}
                      </div>

                        {!assignable ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Link
                              href={mechanicsDetailHref({
                                kind,
                                jetskiId: j.id,
                              })}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                color: "#111",
                                textDecoration: "none",
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              Ver ficha
                            </Link>

                            {j.activeMaintenanceEventId ? (
                              <Link
                                href={mechanicsEventHref({
                                  kind,
                                  jetskiId: j.id,
                                  eventId: j.activeMaintenanceEventId,
                                })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "1px solid #e5e7eb",
                                  background: "#fff",
                                  color: "#111",
                                  textDecoration: "none",
                                  fontSize: 12,
                                  fontWeight: 900,
                                }}
                              >
                                Ver evento
                              </Link>
                            ) : null}
                          </div>
                        ) : null}

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div
                          style={radarStateStyle({
                            operabilityStatus: j.operabilityStatus,
                            busy,
                          })}
                        >
                          {radarStateLabel({
                            operabilityStatus: j.operabilityStatus,
                            busy,
                          })}
                        </div>

                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 900,
                            border: "1px solid #e5e7eb",
                            background: assignable ? "#f0fdf4" : "#f8fafc",
                            color: assignable ? "#166534" : "#64748b",
                          }}
                        >
                          {assignable ? "Asignable" : busy ? "En salida" : "No asignable"}
                        </div>
                      </div>
                    </div>
                  );
                })
              : assets.map((a) => {
                  const busy = busyAssets.has(a.id);
                  const assignable = !busy && a.operabilityStatus === "OPERATIONAL";

                  return (
                    <div
                      key={a.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 16,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        opacity: assignable ? 1 : 0.92,
                      }}
                      title={assignable ? "Asignable" : busy ? "Ocupado en salida" : "Bloqueado por mecánica"}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 950 }}>{a.name}</div>

                        {!assignable ? (
                          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                            {busy ? "En uso / salida activa" : a.blockReason || "No asignable"}
                          </div>
                        ) : null}
                      </div>

                        {!assignable ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Link
                              href={mechanicsDetailHref({
                                kind,
                                assetId: a.id,
                              })}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                color: "#111",
                                textDecoration: "none",
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              Ver ficha
                            </Link>

                            {a.activeMaintenanceEventId ? (
                              <Link
                                href={mechanicsEventHref({
                                  kind,
                                  assetId: a.id,
                                  eventId: a.activeMaintenanceEventId,
                                })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "1px solid #e5e7eb",
                                  background: "#fff",
                                  color: "#111",
                                  textDecoration: "none",
                                  fontSize: 12,
                                  fontWeight: 900,
                                }}
                              >
                                Ver evento
                              </Link>
                            ) : null}
                          </div>
                        ) : null}

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div
                          style={radarStateStyle({
                            operabilityStatus: a.operabilityStatus,
                            busy,
                          })}
                        >
                          {radarStateLabel({
                            operabilityStatus: a.operabilityStatus,
                            busy,
                          })}
                        </div>

                        <div
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 900,
                            border: "1px solid #e5e7eb",
                            background: assignable ? "#f0fdf4" : "#f8fafc",
                            color: assignable ? "#166534" : "#64748b",
                          }}
                        >
                          {assignable ? "Asignable" : busy ? "En uso" : "No asignable"}
                        </div>
                      </div>
                    </div>
                  );
                })}        
            </div>
        </div>
      </div>

      {assignOpen ? <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }} onClick={() => (assignBusy ? null : setAssignOpen(false))}><div style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 14 }} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ fontWeight: 950, fontSize: 18 }}>Asignar a salida</div><button type="button" onClick={() => (assignBusy ? null : setAssignOpen(false))} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 900 }}>Cerrar</button></div><div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>{assignTarget?.customerName || "Cliente"} | {assignTarget?.serviceName || "Servicio"}</div><div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label style={{ display: "grid", gap: 6, fontSize: 13 }}>Monitor / Salida<select value={assignRunId} onChange={(e) => setAssignRunId(e.target.value)} style={{ padding: 10 }}><option value="">Selecciona...</option>{readyRuns.map((r) => <option key={r.id} value={r.id}>{r.monitor?.name || "Monitor"} | {r.status} | {fmtHm(new Date(r.startedAt))}</option>)}</select></label><label style={{ display: "grid", gap: 6, fontSize: 13 }}>{kind === "JETSKI" ? "Moto" : "Recurso"}<select value={assignResourceId} onChange={(e) => setAssignResourceId(e.target.value)} style={{ padding: 10 }}><option value="">Selecciona...</option>{kind === "JETSKI"
        ? assignableJetskis.map((j) => (
            <option key={j.id} value={j.id}>
              {`Moto ${j.number || "-"}`}
            </option>
          ))
        : assignableAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
        ))}</select></label></div>{assignError ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>{assignError}</div> : null}<div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={doAssign} disabled={assignBusy} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: assignBusy ? "#9ca3af" : "#111", color: "#fff", fontWeight: 950 }}>{assignBusy ? "Asignando..." : "Asignar"}</button></div></div></div> : null}
      {actionOpen && actionAssignment ? <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }} onClick={() => (actionBusy ? null : setActionOpen(false))}><div style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 14 }} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ fontWeight: 950, fontSize: 18 }}>Acciones</div><button type="button" onClick={() => (actionBusy ? null : setActionOpen(false))} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 900 }}>Cerrar</button></div><div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13, opacity: 0.85 }}><div><b>Assignment:</b> {actionAssignment.id}</div><div><b>Fin previsto:</b> {actionAssignment.expectedEndAt ? fmtHm(new Date(actionAssignment.expectedEndAt)) : "- pendiente de salida -"}</div></div><div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" disabled={actionBusy} onClick={() => finishAssignment(false)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 950 }}>Finalizar (sin incidencia)</button>
      <button
        type="button"
        disabled={actionBusy}
        onClick={() => {
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
        }}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          fontWeight: 950,
        }}
      >
        Finalizar (con incidencia)
      </button><div style={{ flex: "1 1 auto" }} /><button type="button" disabled={actionBusy} onClick={() => extendAssignment(20, "JETSKI_EXTRA_20")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 950 }}>+20 (jetski)</button><button type="button" disabled={actionBusy} onClick={() => extendAssignment(40, "JETSKI_EXTRA_40")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 950 }}>+40 (jetski)</button><button type="button" disabled={actionBusy} onClick={() => extendAssignment(60, "BOAT_EXTRA_60")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 950 }}>+60 (boat)</button><button type="button" disabled={actionBusy} onClick={() => extendAssignment(120, "BOAT_EXTRA_120")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 950 }}>+120 (boat)</button></div>{actionError ? <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>{actionError}</div> : null}<div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Nota: &quot;Finalizar con incidencia&quot; usa OTHER/LOW por defecto. Luego se puede ampliar a checklist completo.</div></div></div> : null}
    
    {incidentOpen && actionAssignment ? (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          display: "grid",
          placeItems: "center",
          padding: 16,
          zIndex: 60,
        }}
        onClick={() => (incidentBusy ? null : setIncidentOpen(false))}
      >
        <div
          style={{
            width: "min(900px, 100%)",
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Registrar incidencia</div>
            <button
              type="button"
              onClick={() => (incidentBusy ? null : setIncidentOpen(false))}
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

          <div style={{ display: "grid", gap: 6, fontSize: 13, opacity: 0.85 }}>
            <div><b>Assignment:</b> {actionAssignment.id}</div>
            <div><b>Cliente:</b> {actionAssignment.reservation?.customerName || "Cliente"}</div>
            <div>
              <b>Unidad:</b>{" "}
              {kind === "JETSKI"
                ? actionAssignment.jetski?.number
                  ? `Moto ${actionAssignment.jetski.number}`
                  : "Moto"
                : actionAssignment.asset?.name || "Recurso"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Tipo
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as "ACCIDENT" | "DAMAGE" | "MECHANICAL" | "OTHER")}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              >
                <option value="ACCIDENT">Accidente</option>
                <option value="DAMAGE">Daño</option>
                <option value="MECHANICAL">Mecánica</option>
                <option value="OTHER">Otra</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Nivel
              <select
                value={incidentLevel}
                onChange={(e) => {
                  const next = e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
                  setIncidentLevel(next);
                  applyIncidentDefaultsByLevel(next, {
                    setIncidentAffectsOperability,
                    setIncidentOperabilityStatus,
                    setIncidentCreateMaintenanceEvent,
                  });
                }}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Título corto
            <input
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
              placeholder="Ej: golpe lateral, pérdida de potencia..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Descripción
            <textarea
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              rows={3}
              placeholder="Describe lo ocurrido..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4", resize: "vertical" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Notas operativas
            <textarea
              value={incidentNotes}
              onChange={(e) => setIncidentNotes(e.target.value)}
              rows={3}
              placeholder="Observaciones del monitor o de plataforma..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4", resize: "vertical" }}
            />
          </label>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              background: "#fafafa",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>Operatividad</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={incidentAffectsOperability}
                onChange={(e) => setIncidentAffectsOperability(e.target.checked)}
              />
              Esta incidencia afecta a la operatividad
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Estado tras incidencia
              <select
                value={incidentOperabilityStatus}
                onChange={(e) =>
                  setIncidentOperabilityStatus(
                    e.target.value as "" | "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE"
                  )
                }
                disabled={!incidentAffectsOperability}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              >
                <option value="">Selecciona...</option>
                <option value="OPERATIONAL">Operativa</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="DAMAGED">Dañada</option>
                <option value="OUT_OF_SERVICE">Fuera de servicio</option>
              </select>
            </label>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              background: "#fafafa",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>Fianza</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={incidentRetainDeposit}
                onChange={(e) => setIncidentRetainDeposit(e.target.checked)}
              />
              Retener fianza
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Importe retenido (céntimos)
              <input
                value={incidentRetainDepositCents}
                onChange={(e) => setIncidentRetainDepositCents(e.target.value)}
                disabled={!incidentRetainDeposit}
                inputMode="numeric"
                placeholder="Ej: 15000"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              />
            </label>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
              background: "#fafafa",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>Mecánica</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={incidentCreateMaintenanceEvent}
                onChange={(e) => setIncidentCreateMaintenanceEvent(e.target.checked)}
              />
              Crear evento técnico automáticamente
            </label>
          </div>

          {incidentError ? (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                fontWeight: 900,
              }}
            >
              {incidentError}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => (incidentBusy ? null : setIncidentOpen(false))}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontWeight: 900,
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submitIncidentFinish}
              disabled={incidentBusy}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111",
                background: incidentBusy ? "#9ca3af" : "#111",
                color: "#fff",
                fontWeight: 950,
              }}
            >
              {incidentBusy ? "Guardando..." : "Finalizar con incidencia"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </div>
  );
}

const metricCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 4,
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
