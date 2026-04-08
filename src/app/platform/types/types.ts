// src/app/platform/types/types.ts
export type MonitorRunKind = "JETSKI" | "NAUTICA";
export type MonitorRunMode = "MONITOR" | "SOLO" | "TEST";

export type RunStatus = "READY" | "IN_SEA" | "CLOSED";
export type RunAssignmentStatus = "QUEUED" | "ACTIVE" | "FINISHED";

export type AssetType =
  | "BOAT"
  | "TOWBOAT"
  | "JETCAR"
  | "PARASAILING"
  | "FLYBOARD"
  | "TOWABLE"
  | "OTHER";

export type OperabilityStatus =
  | "OPERATIONAL"
  | "MAINTENANCE"
  | "DAMAGED"
  | "OUT_OF_SERVICE";

export type OperabilityCountRow = {
  operabilityStatus: OperabilityStatus;
  _count: number;
};

export type OperabilitySummary = {
  jetskis: OperabilityCountRow[];
  assets: OperabilityCountRow[];
};

export type JetskiAvail = {
  id: string;
  number: number | null;
  model: string | null;
  year?: number | null;
  status: "OPERATIONAL" | string;
  operabilityStatus: OperabilityStatus;
  blockReason?: string | null;
  activeMaintenanceEventId?: string | null;
  activeIncidentId?: string | null;
};

export type AssetAvail = {
  id: string;
  name: string;
  type: AssetType;
  status: "OPERATIONAL" | string;
  operabilityStatus: OperabilityStatus;
  blockReason?: string | null;
  activeMaintenanceEventId?: string | null;
  activeIncidentId?: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  code: string | null;
  note?: string | null;
};

export type MonitorLite = {
  id: string;
  name: string;
  maxCapacity: number | null;
  isActive: boolean;
};

export type QueueItem = {
  reservationId: string;
  reservationUnitId: string;
  queueEnteredAt?: string | null;
  customerName: string | null;
  serviceName: string | null;
  category: string | null;
  durationMinutes: number | null;
  pax: number | null;
  quantity: number | null;
  isLicense?: boolean | null;
  label?: string;
};

export type RunOpen = {
  id: string;
  kind: MonitorRunKind;
  mode: MonitorRunMode;
  status: RunStatus;
  startedAt: string;
  note: string | null;
  displayName: string;

  monitor?: { id: string; name: string; maxCapacity?: number | null } | null;

  monitorJetskiId?: string | null;
  monitorJetski?: { id: string; number: number | null; model: string | null } | null;

  monitorAssetId?: string | null;
  monitorAsset?: { id: string; name: string; type: AssetType } | null;

  assignments: Array<{
    id: string;
    status: RunAssignmentStatus;

    reservationId: string;
    reservationUnitId?: string | null;

    jetskiId?: string | null;
    jetski?: { id?: string; number?: number | null } | null;

    assetId?: string | null;
    asset?: { name?: string | null; type?: string | null } | null;

    createdAt?: string | null;
    startedAt?: string | null;
    expectedEndAt?: string | null;
    durationMinutesSnapshot: number;
    reservation?: { id?: string; customerName?: string | null } | null;
  }>;
};

export type JetskiAvailableResponse = {
  ok: true;
  runId: string | null;
  jetskis: JetskiAvail[];
  usedJetskiIds: string[];
};

export type AssetAvailableResponse = {
  ok: true;
  runId: string | null;
  type: AssetType | null;
  assets: AssetAvail[];
  usedAssetIds: string[];
};

