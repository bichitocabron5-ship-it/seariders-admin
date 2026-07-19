import assert from "node:assert/strict";
import test from "node:test";

import type { PlatformBoardStateSnapshot, PlatformMutationDelta } from "../types/platform-delta";
import type { JetskiAvail, QueueItem, RunOpen } from "../types/types";
import {
  applyOptionalPlatformMutationDelta,
  applyPlatformMutationDelta,
  filterQueueAssignedInRuns,
  queueScopeForKind,
  shouldAcceptLoadAllResponse,
} from "./platform-board-state";

const scope = queueScopeForKind("JETSKI");

function queueItem(id = "unit-1", overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    reservationId: "reservation-1",
    reservationUnitId: id,
    queueEnteredAt: "2026-07-19T08:00:00.000Z",
    customerName: "Customer",
    serviceName: "Jetski",
    category: "JETSKI",
    durationMinutes: 30,
    pax: 1,
    quantity: 1,
    isLicense: false,
    ...overrides,
  };
}

function readyUnit(
  id = "unit-1",
  overrides: Partial<NonNullable<PlatformMutationDelta["reservationUnits"]>[number]> = {}
): NonNullable<PlatformMutationDelta["reservationUnits"]>[number] {
  const reservationId = overrides.reservationId ?? "reservation-1";

  return {
    id,
    reservationId,
    status: "READY_FOR_PLATFORM",
    readyForPlatformAt: "2026-07-19T08:00:00.000Z",
    jetskiId: null,
    serviceCategory: "JETSKI",
    serviceName: "Jetski",
    durationMinutesSnapshot: 30,
    quantitySnapshot: 1,
    paxSnapshot: 1,
    reservation: {
      id: reservationId,
      status: "READY_FOR_PLATFORM",
      customerName: "Customer",
      isLicense: false,
    },
    ...overrides,
  };
}

function jetski(overrides: Partial<JetskiAvail> = {}): JetskiAvail {
  return {
    id: "jetski-1",
    number: 7,
    model: "VX",
    year: 2025,
    currentHours: 10,
    status: "OPERATIONAL",
    operabilityStatus: "OPERATIONAL",
    blockReason: null,
    activeMaintenanceEventId: null,
    activeIncidentId: null,
    ...overrides,
  };
}

function assignment(overrides: Partial<RunOpen["assignments"][number]> = {}): RunOpen["assignments"][number] {
  return {
    id: "assignment-1",
    runId: "run-1",
    status: "QUEUED",
    reservationId: "reservation-1",
    reservationUnitId: "unit-1",
    jetskiId: "jetski-1",
    jetski: { id: "jetski-1", number: 7 },
    assetId: null,
    asset: null,
    createdAt: "2026-07-19T08:01:00.000Z",
    startedAt: null,
    expectedEndAt: null,
    durationMinutesSnapshot: 30,
    reservationUnit: {
      serviceName: "Jetski",
      serviceCategory: "JETSKI",
      durationMinutesSnapshot: 30,
      quantitySnapshot: 1,
      paxSnapshot: 1,
    },
    reservation: {
      id: "reservation-1",
      customerName: "Customer",
    },
    ...overrides,
  };
}

function run(overrides: Partial<RunOpen> = {}): RunOpen {
  return {
    id: "run-1",
    kind: "JETSKI",
    mode: "MONITOR",
    status: "READY",
    startedAt: "2026-07-19T08:00:00.000Z",
    note: null,
    displayName: "Monitor",
    monitor: { id: "monitor-1", name: "Monitor", maxCapacity: 4 },
    monitorJetskiId: null,
    monitorJetski: null,
    monitorAssetId: null,
    monitorAsset: null,
    assignments: [],
    ...overrides,
  };
}

function boardState(overrides: Partial<PlatformBoardStateSnapshot> = {}): PlatformBoardStateSnapshot {
  return {
    runs: [run()],
    queue: [queueItem()],
    jetskis: [jetski()],
    assets: [],
    operability: null,
    ...overrides,
  };
}

test("assign moves the confirmed unit from queue to assigned without re-adding its queue item", () => {
  const assigned = assignment({ reservationUnitId: "unit-1" });
  const delta: PlatformMutationDelta = {
    mutation: "assign",
    runId: "run-1",
    run: run({ assignments: [assigned] }),
    assignments: [assigned],
    removedQueueUnitIds: ["unit-1"],
    reservationUnits: [readyUnit("unit-1", { jetskiId: "jetski-1" })],
    queueItems: [queueItem("unit-1")],
  };

  const after = applyPlatformMutationDelta(boardState(), delta, scope);

  assert.equal(after.queue.length, 0);
  assert.equal(after.runs[0].assignments.length, 1);
  assert.equal(after.runs[0].assignments[0].id, "assignment-1");
  assert.equal(after.runs[0].assignments[0].jetskiId, "jetski-1");
});

test("assigning one of two units in the same reservation leaves only the other unit queued", () => {
  const assigned = assignment({ reservationUnitId: "unit-1" });
  const before = boardState({
    queue: [
      queueItem("unit-1", { reservationId: "reservation-1" }),
      queueItem("unit-2", { reservationId: "reservation-1" }),
    ],
  });

  const after = applyPlatformMutationDelta(
    before,
    {
      mutation: "assign",
      runId: "run-1",
      run: run({ assignments: [assigned] }),
      assignments: [assigned],
      removedQueueUnitIds: ["unit-1"],
      reservationUnits: [
        readyUnit("unit-1", { reservationId: "reservation-1", jetskiId: "jetski-1" }),
      ],
      queueItems: [queueItem("unit-1", { reservationId: "reservation-1" })],
    },
    scope
  );

  assert.deepEqual(after.queue.map((item) => item.reservationUnitId), ["unit-2"]);
  assert.equal(after.queue[0].reservationId, "reservation-1");
  assert.equal(after.runs[0].assignments[0].reservationUnitId, "unit-1");
});

test("depart moves a queued assignment to active locally", () => {
  const active = assignment({
    status: "ACTIVE",
    startedAt: "2026-07-19T08:05:00.000Z",
    expectedEndAt: "2026-07-19T08:35:00.000Z",
  });
  const before = boardState({
    runs: [run({ assignments: [assignment()] })],
    queue: [],
  });

  const after = applyPlatformMutationDelta(
    before,
    {
      mutation: "depart",
      runId: "run-1",
      run: run({ status: "IN_SEA", startedAt: "2026-07-19T08:05:00.000Z", assignments: [active] }),
      assignments: [active],
      reservationUnits: [{ id: "unit-1", reservationId: "reservation-1", status: "IN_SEA" }],
      removedQueueUnitIds: ["unit-1"],
    },
    scope
  );

  assert.equal(after.runs[0].status, "IN_SEA");
  assert.equal(after.runs[0].assignments[0].status, "ACTIVE");
  assert.equal(after.runs[0].assignments[0].expectedEndAt, "2026-07-19T08:35:00.000Z");
  assert.equal(after.queue.length, 0);
});

test("finish removes the finished assignment and leaves no duplicate queue entry behind", () => {
  const before = boardState({
    runs: [run({ status: "IN_SEA", assignments: [assignment({ status: "ACTIVE" })] })],
    queue: [queueItem("unit-1"), queueItem("unit-2", { reservationId: "reservation-2" })],
  });

  const after = applyPlatformMutationDelta(
    before,
    {
      mutation: "finish",
      runId: "run-1",
      run: run({ status: "READY", assignments: [] }),
      removedAssignmentIds: ["assignment-1"],
      reservationUnits: [{ id: "unit-1", reservationId: "reservation-1", status: "WAITING" }],
      jetskis: [jetski({ currentHours: 10.5 })],
    },
    scope
  );

  assert.equal(after.runs[0].status, "READY");
  assert.equal(after.runs[0].assignments.length, 0);
  assert.equal(after.jetskis[0].currentHours, 10.5);
  assert.deepEqual(after.queue.map((item) => item.reservationUnitId), ["unit-2"]);
});

test("extend updates expected end and duration locally", () => {
  const before = boardState({
    runs: [run({ status: "IN_SEA", assignments: [assignment({ status: "ACTIVE", durationMinutesSnapshot: 30 })] })],
    queue: [],
  });
  const extended = assignment({
    status: "ACTIVE",
    durationMinutesSnapshot: 45,
    expectedEndAt: "2026-07-19T08:50:00.000Z",
  });

  const after = applyPlatformMutationDelta(
    before,
    {
      mutation: "extend",
      runId: "run-1",
      assignment: extended,
    },
    scope
  );

  assert.equal(after.runs[0].assignments[0].durationMinutesSnapshot, 45);
  assert.equal(after.runs[0].assignments[0].expectedEndAt, "2026-07-19T08:50:00.000Z");
});

test("unassign removes the assignment and returns the unit to the queue once", () => {
  const before = boardState({
    runs: [run({ assignments: [assignment()] })],
    queue: [queueItem("unit-1")],
  });

  const after = applyPlatformMutationDelta(
    before,
    {
      mutation: "unassign",
      runId: "run-1",
      run: run({ assignments: [] }),
      removedAssignmentIds: ["assignment-1"],
      reservationUnits: [readyUnit("unit-1", { readyForPlatformAt: "2026-07-19T08:10:00.000Z" })],
      queueItems: [queueItem("unit-1", { queueEnteredAt: "2026-07-19T08:10:00.000Z" })],
    },
    scope
  );

  assert.equal(after.runs[0].assignments.length, 0);
  assert.equal(after.queue.length, 1);
  assert.equal(after.queue[0].reservationUnitId, "unit-1");
  assert.equal(after.queue[0].queueEnteredAt, "2026-07-19T08:10:00.000Z");
});

test("an older polling response cannot overwrite a newer mutation", () => {
  assert.equal(
    shouldAcceptLoadAllResponse(
      { requestId: 4, mutationRequestIdAtStart: 1, appliedMutationRequestIdAtStart: 1 },
      { latestLoadAllRequestId: 4, latestMutationRequestId: 2, latestAppliedMutationRequestId: 2 }
    ),
    false
  );
});

test("a failed mutation with no delta preserves the previous local state", () => {
  const before = boardState();

  const after = applyOptionalPlatformMutationDelta(before, null, scope);

  assert.equal(after, before);
  assert.equal(after.queue.length, 1);
  assert.equal(after.runs[0].assignments.length, 0);
});

test("a later polling response is accepted so another operator can appear", () => {
  const fresh = shouldAcceptLoadAllResponse(
    { requestId: 5, mutationRequestIdAtStart: 2, appliedMutationRequestIdAtStart: 2 },
    { latestLoadAllRequestId: 5, latestMutationRequestId: 2, latestAppliedMutationRequestId: 2 }
  );

  const pollingSnapshot = boardState({ queue: [queueItem("unit-2")] });

  assert.equal(fresh, true);
  assert.equal(pollingSnapshot.queue[0].reservationUnitId, "unit-2");
});

test("accepted polling snapshots do not reintroduce units that are still assigned", () => {
  const snapshotRuns = [run({ assignments: [assignment({ reservationUnitId: "unit-1" })] })];
  const snapshotQueue = [queueItem("unit-1"), queueItem("unit-2")];

  const filteredQueue = filterQueueAssignedInRuns(snapshotQueue, snapshotRuns);

  assert.deepEqual(filteredQueue.map((item) => item.reservationUnitId), ["unit-2"]);
});
