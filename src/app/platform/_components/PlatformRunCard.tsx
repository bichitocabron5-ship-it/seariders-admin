"use client";

import type { CSSProperties } from "react";
import type { MonitorRunKind, RunOpen } from "../types/types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtHm(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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

function timerLabel(msLeft: number | null) {
  if (msLeft === null) return "";
  if (msLeft <= 0) return `+${msToClock(Math.abs(msLeft))}`;
  return msToClock(msLeft);
}

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
      <div
        style={{
          position: "relative",
          height: 12,
          borderRadius: 999,
          background: tone.track,
          overflow: "hidden",
          border: "1px solid rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, p * 100))}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${tone.fill} 0%, ${tone.fill}cc 100%)`,
            transition: "width 0.4s ease",
          }}
        />
        {[25, 50, 75].map((mark) => (
          <div
            key={mark}
            style={{
              position: "absolute",
              left: `${mark}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: "rgba(15, 23, 42, 0.18)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: "#64748b",
          fontWeight: 800,
        }}
      >
        <span>Salida</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>Fin</span>
      </div>
    </div>
  );
}

export default function PlatformRunCard({
  run,
  kind,
  now,
  assignedQueueWarnMinutes,
  assignedQueueCriticalMinutes,
  departBusy,
  closeBusy,
  unassignBusyAssignmentId,
  onDepartRun,
  onCloseRun,
  onOpenAssignmentActions,
  onUnassignAssignment,
}: {
  run: RunOpen;
  kind: MonitorRunKind;
  now: number;
  assignedQueueWarnMinutes: number;
  assignedQueueCriticalMinutes: number;
  departBusy: boolean;
  closeBusy: boolean;
  unassignBusyAssignmentId: string | null;
  onDepartRun: (runId: string) => void;
  onCloseRun: (runId: string) => void;
  onOpenAssignmentActions: (assignment: RunOpen["assignments"][0]) => void;
  onUnassignAssignment: (assignmentId: string) => void;
}) {
  const activeAssignments = (run.assignments || []).filter((assignment) => assignment.status === "ACTIVE" || assignment.status === "QUEUED");
  const hasActiveOrQueuedAssignments = activeAssignments.length > 0;
  const canCloseRun = (run.status === "READY" || run.status === "IN_SEA") && !hasActiveOrQueuedAssignments;

  return (
    <div style={runCardStyle}>
      <div style={runHeaderStyle}>
        <div style={runHeaderMetaStyle}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{run.monitor?.name || "Monitor"}</div>
          <div style={{ ...statusBadgeStyle, background: run.status === "IN_SEA" ? "#ecfeff" : "#f8fafc" }}>{run.status}</div>
          <div style={smallMetaStyle}>
            Salida iniciada: <b>{fmtHm(new Date(run.startedAt))}</b>
          </div>
          {run.monitorJetski ? <div style={smallMetaStyle}>Moto monitor: <b>#{run.monitorJetski.number || "-"}</b></div> : null}
          {run.monitorAsset ? <div style={smallMetaStyle}>Recurso monitor: <b>{run.monitorAsset.name}</b></div> : null}
        </div>

        <div style={runHeaderActionsStyle}>
          <button
            type="button"
            onClick={() => onDepartRun(run.id)}
            disabled={run.status !== "READY" || departBusy || closeBusy}
            style={{
              ...darkButtonStyle,
              background: run.status !== "READY" || departBusy || closeBusy ? "#9ca3af" : "#111",
              cursor: run.status !== "READY" || departBusy || closeBusy ? "not-allowed" : "pointer",
            }}
          >
            {departBusy ? "Iniciando..." : "Iniciar salida"}
          </button>

          <button
            type="button"
            onClick={() => onCloseRun(run.id)}
            disabled={!canCloseRun || closeBusy || departBusy}
            title={canCloseRun ? "Cerrar salida y liberar monitor/recurso" : "Solo disponible en READY/IN_SEA y sin clientes asignados"}
            style={{
              ...dangerGhostButtonStyle,
              background: !canCloseRun || closeBusy || departBusy ? "#fecaca" : "#fff",
              cursor: !canCloseRun || closeBusy || departBusy ? "not-allowed" : "pointer",
            }}
          >
            {closeBusy ? "Desasignando..." : "Desasignar"}
          </button>

          {run.note ? <div style={smallMetaStyle}>Nota: {run.note}</div> : null}
        </div>
      </div>

      <div style={assignmentsGridStyle}>
        {activeAssignments.map((assignment) => {
          const isQueued = assignment.status === "QUEUED";
          const canUnassign = run.status !== "IN_SEA" || isQueued;
          const queuedAtMs = assignment.createdAt ? new Date(assignment.createdAt).getTime() : null;
          const queuedWaitMs = isQueued && queuedAtMs ? Math.max(0, now - queuedAtMs) : null;
          const queuedWarnMs = assignedQueueWarnMinutes * 60_000;
          const queuedCriticalMs = assignedQueueCriticalMinutes * 60_000;
          const queuedIsWarn = queuedWaitMs !== null && queuedWaitMs >= queuedWarnMs;
          const queuedIsCritical = queuedWaitMs !== null && queuedWaitMs >= queuedCriticalMs;
          const startMs = assignment.startedAt ? new Date(assignment.startedAt).getTime() : null;
          const endMs = assignment.expectedEndAt ? new Date(assignment.expectedEndAt).getTime() : null;
          const hasTimes = !isQueued && startMs !== null && endMs !== null;
          const totalMs = hasTimes ? Math.max(1, endMs - startMs) : 1;
          const elapsedMs = hasTimes ? clamp(now - startMs, 0, totalMs) : 0;
          const msLeft = hasTimes ? endMs - now : null;
          const progress = hasTimes ? elapsedMs / totalMs : 0;
          const colors = hasTimes
            ? clsTimer(msLeft || 0)
            : queuedIsCritical
              ? { bd: "#fecaca", bg: "#fff1f2", fg: "#b91c1c" }
              : queuedIsWarn
                ? { bd: "#fde68a", bg: "#fffbeb", fg: "#92400e" }
                : { bd: "#e5e7eb", bg: "#f9fafb", fg: "#111" };
          const customer = assignment.reservation?.customerName || "Cliente";
          const resourceLabel = kind === "JETSKI"
            ? assignment.jetski?.number
              ? `Moto ${assignment.jetski.number}`
              : "Moto"
            : assignment.asset?.name || "Recurso";
          const mins = assignment.durationMinutesSnapshot || null;

          return (
            <div key={assignment.id} style={{ ...assignmentCardStyle, border: `1px solid ${colors.bd}`, background: colors.bg }}>
              <div style={assignmentHeaderStyle}>
                <div style={{ fontWeight: 950 }}>
                  {customer}
                  <span style={{ opacity: 0.75 }}> | {resourceLabel}</span>
                  {mins ? <span style={{ opacity: 0.75 }}> | {mins} min</span> : null}
                </div>
                <div style={assignmentBadgesStyle}>
                  <div style={{ ...statusBadgeStyle, background: "#ffffffaa", border: `1px solid ${colors.bd}`, color: colors.fg }}>
                    {isQueued ? "QUEUE" : msLeft !== null && msLeft <= 0 ? "EXTRA" : "EN CURSO"}
                  </div>
                  <div style={{ fontWeight: 950, color: colors.fg, fontSize: 20 }}>
                    {isQueued ? `Pendiente${queuedWaitMs !== null ? ` | ${msToClock(queuedWaitMs)}` : ""}` : msLeft !== null ? `${timerLabel(msLeft)} ${msLeft <= 0 ? "extra" : "restantes"}` : ""}
                  </div>
                </div>
              </div>

              <div style={smallInfoRowStyle}>
                {hasTimes ? (
                  <>
                    <div>Inicio: {fmtHm(new Date(startMs!))}</div>
                    <div>Fin: {fmtHm(new Date(endMs!))}</div>
                  </>
                ) : (
                  <div>
                    Aún no ha iniciado la salida
                    {queuedWaitMs !== null && queuedAtMs ? ` | en cola desde ${fmtHm(new Date(queuedAtMs))}` : ""}
                    {queuedIsCritical ? ` | ALERTA CRÍTICA (${assignedQueueCriticalMinutes}+ min)` : queuedIsWarn ? ` | Alerta de espera (${assignedQueueWarnMinutes}+ min)` : ""}
                  </div>
                )}
              </div>

              {hasTimes ? (
                <div style={{ ...timingPanelStyle, border: `1px solid ${colors.bd}` }}>
                  <div style={timingHeaderStyle}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: colors.fg }}>Progreso temporal</div>
                    <div style={{ fontSize: 12, color: colors.fg, fontWeight: 900 }}>{Math.round(progress * 100)}%</div>
                  </div>
                  <TimelineBar progress={progress} msLeft={msLeft ?? 0} />
                  <div style={timingMetaStyle}>
                    <span>Inicio: <b>{fmtHm(new Date(startMs!))}</b></span>
                    <span>Fin previsto: <b>{fmtHm(new Date(endMs!))}</b></span>
                  </div>
                </div>
              ) : null}

              <div style={assignmentActionsStyle}>
                <button
                  type="button"
                  onClick={() => onOpenAssignmentActions(assignment)}
                  disabled={isQueued}
                  style={{
                    ...ghostButtonStyle,
                    opacity: isQueued ? 0.6 : 1,
                    cursor: isQueued ? "not-allowed" : "pointer",
                    background: isQueued ? "#f3f4f6" : "#fff",
                  }}
                >
                  Acciones
                </button>

                <button
                  type="button"
                  onClick={() => onUnassignAssignment(assignment.id)}
                  disabled={!canUnassign || unassignBusyAssignmentId === assignment.id}
                  title={canUnassign ? "Quitar cliente de la salida y devolverlo a cola" : "No se puede desasignar un cliente activo en IN_SEA"}
                  style={{
                    ...dangerGhostButtonStyle,
                    background: !canUnassign || unassignBusyAssignmentId === assignment.id ? "#fecaca" : "#fff",
                    cursor: !canUnassign || unassignBusyAssignmentId === assignment.id ? "not-allowed" : "pointer",
                  }}
                >
                  {unassignBusyAssignmentId === assignment.id ? "Desasignando..." : "Desasignar cliente"}
                </button>
              </div>
            </div>
          );
        })}

        {!hasActiveOrQueuedAssignments ? (
          <div style={emptyTextStyle}>No hay clientes activos o pendientes en esta salida.</div>
        ) : null}
      </div>
    </div>
  );
}

const runCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#fff",
};

const runHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "baseline",
};

const runHeaderMetaStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "baseline",
};

const statusBadgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  fontWeight: 900,
  fontSize: 12,
};

const smallMetaStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.85,
};

const runHeaderActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
  alignItems: "center",
  width: "min(100%, 420px)",
};

const darkButtonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #111",
  color: "#fff",
  fontWeight: 900,
  width: "100%",
};

const ghostButtonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #111",
  fontWeight: 900,
  width: "100%",
};

const dangerGhostButtonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  color: "#991b1b",
  fontWeight: 900,
  width: "100%",
};

const assignmentsGridStyle: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 12,
};

const assignmentCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)",
};

const assignmentHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "baseline",
  flexWrap: "wrap",
};

const assignmentBadgesStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const smallInfoRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 12,
  opacity: 0.85,
};

const timingPanelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 14,
  background: "#ffffffaa",
};

const timingHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const timingMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#475569",
};

const assignmentActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 8,
  marginTop: 2,
};

const emptyTextStyle: CSSProperties = {
  opacity: 0.7,
  fontSize: 13,
};
