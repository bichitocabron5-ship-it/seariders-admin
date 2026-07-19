import type {
  AssetAvail,
  JetskiAvail,
  MonitorRunKind,
  QueueItem,
  RunOpen,
} from "../types/types";
import type {
  BoardAssignment,
  PlatformBoardScope,
  PlatformBoardStateSnapshot,
  PlatformMutationDelta,
} from "../types/platform-delta";

export type LoadAllRequestFence = {
  requestId: number;
  mutationRequestIdAtStart: number;
  appliedMutationRequestIdAtStart: number;
};

export type LoadAllCurrentFence = {
  latestLoadAllRequestId: number;
  latestMutationRequestId: number;
  latestAppliedMutationRequestId: number;
};

function assignmentSortKey(assignment: BoardAssignment) {
  return [
    assignment.status === "ACTIVE" ? "0" : assignment.status === "QUEUED" ? "1" : "2",
    assignment.createdAt ?? "",
    assignment.startedAt ?? "",
    assignment.id,
  ].join("|");
}

function sortAssignments(assignments: BoardAssignment[]) {
  return [...assignments].sort((a, b) => assignmentSortKey(a).localeCompare(assignmentSortKey(b)));
}

function upsertById<T extends { id: string }>(items: T[], nextItems: readonly T[]) {
  if (nextItems.length === 0) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const nextItem of nextItems) {
    byId.set(nextItem.id, { ...byId.get(nextItem.id), ...nextItem });
  }

  return items.map((item) => byId.get(item.id) ?? item).concat(nextItems.filter((item) => !items.some((current) => current.id === item.id)));
}

function queueMatchesScope(item: QueueItem, scope: PlatformBoardScope) {
  const category = item.category?.toUpperCase() ?? null;
  const scopedCategories = scope.categories.map((entry) => entry.toUpperCase()).filter(Boolean);

  if (scopedCategories.length > 0) {
    return category !== null && scopedCategories.includes(category);
  }

  if (scope.kind === "JETSKI") return category === "JETSKI";
  return category !== "JETSKI";
}

function getOpenAssignedReservationUnitIds(runs: readonly RunOpen[]) {
  const unitIds = new Set<string>();

  for (const run of runs) {
    for (const assignment of run.assignments ?? []) {
      if (
        assignment.reservationUnitId &&
        (assignment.status === "QUEUED" || assignment.status === "ACTIVE")
      ) {
        unitIds.add(assignment.reservationUnitId);
      }
    }
  }

  return unitIds;
}

export function filterQueueAssignedInRuns(queue: QueueItem[], runs: readonly RunOpen[]) {
  const assignedUnitIds = getOpenAssignedReservationUnitIds(runs);
  if (assignedUnitIds.size === 0) return queue;

  return queue.filter((item) => !assignedUnitIds.has(item.reservationUnitId));
}

export function queueItemFromReservationUnit(
  unit: NonNullable<PlatformMutationDelta["reservationUnit"]>
): QueueItem | null {
  if (unit.status !== "READY_FOR_PLATFORM" || !unit.reservation) return null;

  return {
    reservationId: unit.reservationId,
    reservationUnitId: unit.id,
    queueEnteredAt: unit.readyForPlatformAt ?? null,
    customerName: unit.reservation.customerName,
    serviceName: unit.serviceName ?? null,
    category: unit.serviceCategory ?? null,
    durationMinutes: unit.durationMinutesSnapshot ?? null,
    pax: unit.paxSnapshot ?? null,
    quantity: unit.quantitySnapshot ?? null,
    isLicense: Boolean(unit.reservation.isLicense),
  };
}

export function applyRunsDelta(runs: RunOpen[], delta: PlatformMutationDelta) {
  let nextRuns = runs;
  const removedAssignmentIds = new Set(delta.removedAssignmentIds ?? []);

  if (removedAssignmentIds.size > 0) {
    nextRuns = nextRuns.map((run) => ({
      ...run,
      assignments: run.assignments.filter((assignment) => !removedAssignmentIds.has(assignment.id)),
    }));
  }

  const incomingRuns = [...(delta.runs ?? []), ...(delta.run ? [delta.run] : [])];
  if (incomingRuns.length > 0) {
    const byRunId = new Map(nextRuns.map((run) => [run.id, run]));
    for (const incomingRun of incomingRuns) {
      byRunId.set(incomingRun.id, incomingRun);
    }

    nextRuns = nextRuns
      .map((run) => byRunId.get(run.id) ?? run)
      .concat(incomingRuns.filter((run) => !runs.some((current) => current.id === run.id)));
  }

  const assignments = [...(delta.assignments ?? []), ...(delta.assignment ? [delta.assignment] : [])];
  for (const assignment of assignments) {
    const targetRunId = assignment.runId ?? delta.runId ?? nextRuns.find((run) => run.assignments.some((entry) => entry.id === assignment.id))?.id;
    if (!targetRunId) continue;

    nextRuns = nextRuns.map((run) => {
      const withoutAssignment = run.assignments.filter((entry) => entry.id !== assignment.id);
      if (run.id !== targetRunId) {
        return withoutAssignment.length === run.assignments.length ? run : { ...run, assignments: withoutAssignment };
      }

      return {
        ...run,
        assignments: sortAssignments([...withoutAssignment, assignment]),
      };
    });
  }

  const removedRunIds = new Set(delta.removedRunIds ?? []);
  if (removedRunIds.size > 0) {
    nextRuns = nextRuns.filter((run) => !removedRunIds.has(run.id));
  }

  return nextRuns;
}

export function applyQueueDelta(
  queue: QueueItem[],
  delta: PlatformMutationDelta,
  scope: PlatformBoardScope
) {
  const removedQueueUnitIds = new Set(delta.removedQueueUnitIds ?? []);

  for (const assignment of [...(delta.assignments ?? []), ...(delta.assignment ? [delta.assignment] : [])]) {
    if (assignment.reservationUnitId) removedQueueUnitIds.add(assignment.reservationUnitId);
  }

  for (const run of [...(delta.runs ?? []), ...(delta.run ? [delta.run] : [])]) {
    for (const assignment of run.assignments ?? []) {
      if (
        assignment.reservationUnitId &&
        (assignment.status === "QUEUED" || assignment.status === "ACTIVE")
      ) {
        removedQueueUnitIds.add(assignment.reservationUnitId);
      }
    }
  }

  for (const unit of [...(delta.reservationUnits ?? []), ...(delta.reservationUnit ? [delta.reservationUnit] : [])]) {
    if (unit.status !== "READY_FOR_PLATFORM") removedQueueUnitIds.add(unit.id);
  }

  let nextQueue = queue.filter((item) => !removedQueueUnitIds.has(item.reservationUnitId));
  const explicitQueueItems = [...(delta.queueItems ?? []), ...(delta.queueItem ? [delta.queueItem] : [])]
    .filter((item) => !removedQueueUnitIds.has(item.reservationUnitId));
  const derivedQueueItems = [...(delta.reservationUnits ?? []), ...(delta.reservationUnit ? [delta.reservationUnit] : [])]
    .filter((unit) => !removedQueueUnitIds.has(unit.id))
    .map(queueItemFromReservationUnit)
    .filter((item): item is QueueItem => item !== null);

  for (const item of [...explicitQueueItems, ...derivedQueueItems]) {
    if (!queueMatchesScope(item, scope)) continue;
    nextQueue = nextQueue.filter((entry) => entry.reservationUnitId !== item.reservationUnitId);
    nextQueue.push(item);
  }

  return nextQueue;
}

export function applyJetskisDelta(jetskis: JetskiAvail[], delta: PlatformMutationDelta) {
  return upsertById(jetskis, [...(delta.jetskis ?? []), ...(delta.jetski ? [delta.jetski] : [])]);
}

export function applyAssetsDelta(assets: AssetAvail[], delta: PlatformMutationDelta) {
  return upsertById(assets, [...(delta.assets ?? []), ...(delta.asset ? [delta.asset] : [])]);
}

export function applyPlatformMutationDelta(
  state: PlatformBoardStateSnapshot,
  delta: PlatformMutationDelta,
  scope: PlatformBoardScope
): PlatformBoardStateSnapshot {
  return {
    runs: applyRunsDelta(state.runs, delta),
    queue: applyQueueDelta(state.queue, delta, scope),
    jetskis: applyJetskisDelta(state.jetskis, delta),
    assets: applyAssetsDelta(state.assets, delta),
    operability: delta.operability ?? state.operability,
  };
}

export function applyOptionalPlatformMutationDelta(
  state: PlatformBoardStateSnapshot,
  delta: PlatformMutationDelta | null | undefined,
  scope: PlatformBoardScope
) {
  return delta ? applyPlatformMutationDelta(state, delta, scope) : state;
}

export function shouldAcceptLoadAllResponse(
  request: LoadAllRequestFence,
  current: LoadAllCurrentFence
) {
  return (
    request.requestId === current.latestLoadAllRequestId &&
    request.mutationRequestIdAtStart === current.latestMutationRequestId &&
    request.appliedMutationRequestIdAtStart === current.latestAppliedMutationRequestId
  );
}

export function queueScopeForKind(kind: MonitorRunKind, categories: readonly string[] = []): PlatformBoardScope {
  return { kind, categories };
}
