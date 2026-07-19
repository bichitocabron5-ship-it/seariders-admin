import type {
  AssetAvail,
  JetskiAvail,
  MonitorRunKind,
  OperabilitySummary,
  QueueItem,
  RunOpen,
} from "./types";

export type BoardAssignment = RunOpen["assignments"][number];

export type PlatformReservationDelta = {
  id: string;
  status: string;
  readyForPlatformAt?: string | null;
  departureAt?: string | null;
  arrivalAt?: string | null;
};

export type PlatformReservationUnitDelta = {
  id: string;
  reservationId: string;
  status: string;
  readyForPlatformAt?: string | null;
  jetskiId?: string | null;
  serviceCategory?: string | null;
  serviceName?: string | null;
  durationMinutesSnapshot?: number | null;
  quantitySnapshot?: number | null;
  paxSnapshot?: number | null;
  reservation?: {
    id: string;
    status: string;
    customerName: string | null;
    isLicense?: boolean | null;
  } | null;
};

export type PlatformMutationName =
  | "assign"
  | "depart"
  | "finish"
  | "extend"
  | "unassign"
  | "close";

export type PlatformMutationDelta = {
  mutation: PlatformMutationName;
  runId?: string | null;
  run?: RunOpen | null;
  runs?: RunOpen[];
  assignment?: BoardAssignment | null;
  assignments?: BoardAssignment[];
  removedAssignmentIds?: string[];
  reservationUnit?: PlatformReservationUnitDelta | null;
  reservationUnits?: PlatformReservationUnitDelta[];
  reservation?: PlatformReservationDelta | null;
  reservations?: PlatformReservationDelta[];
  queueItem?: QueueItem | null;
  queueItems?: QueueItem[];
  removedQueueUnitIds?: string[];
  removedRunIds?: string[];
  jetski?: JetskiAvail | null;
  jetskis?: JetskiAvail[];
  asset?: AssetAvail | null;
  assets?: AssetAvail[];
  operability?: OperabilitySummary | null;
};

export type PlatformBoardScope = {
  kind: MonitorRunKind;
  categories: readonly string[];
};

export type PlatformBoardStateSnapshot = {
  runs: RunOpen[];
  queue: QueueItem[];
  jetskis: JetskiAvail[];
  assets: AssetAvail[];
  operability: OperabilitySummary | null;
};

