import type { Prisma } from "@prisma/client";
import {
  MonitorRunMode,
  ReservationUnitStatus,
  RunAssignmentStatus,
} from "@prisma/client";

import type {
  AssetAvail,
  JetskiAvail,
  OperabilitySummary,
  QueueItem,
  RunOpen,
} from "@/app/platform/types/types";
import type {
  PlatformMutationDelta,
  PlatformMutationName,
  PlatformReservationDelta,
  PlatformReservationUnitDelta,
} from "@/app/platform/types/platform-delta";
import { platformAssignmentBlockingReason } from "@/lib/operability";
import {
  getOperationalBlockLabel,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";

type Tx = Prisma.TransactionClient;

type Dateish = Date | string | null | undefined;

function iso(value: Dateish) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function getRunDisplayName(run: {
  mode: MonitorRunMode;
  monitor?: { name: string | null } | null;
}) {
  if (run.mode === MonitorRunMode.SOLO) return "Sin monitor";
  if (run.mode === MonitorRunMode.TEST) return "Modo prueba";
  return run.monitor?.name?.trim() || "Monitor";
}

function mapAssignmentForBoard(assignment: {
  id: string;
  runId: string;
  status: RunAssignmentStatus;
  reservationId: string;
  reservationUnitId: string | null;
  jetskiId: string | null;
  jetski: { id: string; number: number | null } | null;
  assetId: string | null;
  asset: { id: string; name: string; type: string; model?: string | null } | null;
  createdAt: Date;
  startedAt: Date | null;
  expectedEndAt: Date | null;
  durationMinutesSnapshot: number;
  reservationUnit: {
    serviceName: string | null;
    serviceCategory: string | null;
    durationMinutesSnapshot: number | null;
    quantitySnapshot: number | null;
    paxSnapshot: number | null;
  } | null;
  reservation: {
    id: string;
    customerName: string | null;
  } | null;
}): RunOpen["assignments"][number] {
  return {
    id: assignment.id,
    runId: assignment.runId,
    status: assignment.status,
    reservationId: assignment.reservationId,
    reservationUnitId: assignment.reservationUnitId,
    jetskiId: assignment.jetskiId,
    jetski: assignment.jetski
      ? {
          id: assignment.jetski.id,
          number: assignment.jetski.number,
        }
      : null,
    assetId: assignment.assetId,
    asset: assignment.asset
      ? {
          id: assignment.asset.id,
          name: assignment.asset.name,
          type: assignment.asset.type,
          model: assignment.asset.model ?? null,
        }
      : null,
    createdAt: iso(assignment.createdAt),
    startedAt: iso(assignment.startedAt),
    expectedEndAt: iso(assignment.expectedEndAt),
    durationMinutesSnapshot: assignment.durationMinutesSnapshot,
    reservationUnit: assignment.reservationUnit,
    reservation: assignment.reservation,
  };
}

function mapQueueItemFromUnit(unit: PlatformReservationUnitDelta): QueueItem | null {
  if (unit.status !== ReservationUnitStatus.READY_FOR_PLATFORM || !unit.reservation) {
    return null;
  }

  return {
    reservationId: unit.reservationId,
    reservationUnitId: unit.id,
    queueEnteredAt: unit.readyForPlatformAt ?? null,
    customerName: unit.reservation.customerName,
    serviceName: unit.serviceName ?? null,
    category: unit.serviceCategory ?? null,
    durationMinutes: getOperationalDurationMinutes({
      category: unit.serviceCategory ?? null,
      durationMinutes: unit.durationMinutesSnapshot ?? null,
      quantity: unit.quantitySnapshot ?? null,
    }),
    pax: unit.paxSnapshot ?? null,
    quantity: unit.quantitySnapshot ?? null,
    isLicense: Boolean(unit.reservation.isLicense),
    label: getOperationalBlockLabel({
      serviceName: unit.serviceName ?? null,
      quantity: unit.quantitySnapshot ?? null,
      pax: unit.paxSnapshot ?? null,
      durationMinutes: unit.durationMinutesSnapshot ?? null,
      category: unit.serviceCategory ?? null,
    }),
  };
}

export async function getPlatformRunForBoardTx(tx: Tx, runId: string): Promise<RunOpen | null> {
  const run = await tx.monitorRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      kind: true,
      mode: true,
      monitorId: true,
      status: true,
      startedAt: true,
      note: true,
      monitorJetskiId: true,
      monitorAssetId: true,
      monitor: { select: { id: true, name: true, maxCapacity: true } },
      monitorJetski: { select: { id: true, number: true, model: true } },
      monitorAsset: { select: { id: true, name: true, type: true } },
      assignments: {
        where: { status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { startedAt: "asc" }],
        select: {
          id: true,
          runId: true,
          reservationId: true,
          reservationUnitId: true,
          reservationUnit: {
            select: {
              serviceName: true,
              serviceCategory: true,
              durationMinutesSnapshot: true,
              quantitySnapshot: true,
              paxSnapshot: true,
            },
          },
          jetskiId: true,
          jetski: { select: { id: true, number: true } },
          assetId: true,
          asset: { select: { id: true, name: true, type: true, model: true } },
          status: true,
          createdAt: true,
          startedAt: true,
          expectedEndAt: true,
          durationMinutesSnapshot: true,
          reservation: {
            select: {
              id: true,
              customerName: true,
            },
          },
        },
      },
    },
  });

  if (!run) return null;

  return {
    id: run.id,
    kind: run.kind,
    mode: run.mode,
    status: run.status,
    startedAt: iso(run.startedAt) ?? new Date().toISOString(),
    note: run.note,
    displayName: getRunDisplayName(run),
    monitor: run.monitor,
    monitorJetskiId: run.monitorJetskiId,
    monitorJetski: run.monitorJetski,
    monitorAssetId: run.monitorAssetId,
    monitorAsset: run.monitorAsset,
    assignments: run.assignments.map(mapAssignmentForBoard),
  };
}

export async function getPlatformAssignmentForBoardTx(
  tx: Tx,
  assignmentId: string
) {
  const assignment = await tx.monitorRunAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      runId: true,
      reservationId: true,
      reservationUnitId: true,
      reservationUnit: {
        select: {
          serviceName: true,
          serviceCategory: true,
          durationMinutesSnapshot: true,
          quantitySnapshot: true,
          paxSnapshot: true,
        },
      },
      jetskiId: true,
      jetski: { select: { id: true, number: true } },
      assetId: true,
      asset: { select: { id: true, name: true, type: true, model: true } },
      status: true,
      createdAt: true,
      startedAt: true,
      expectedEndAt: true,
      durationMinutesSnapshot: true,
      reservation: {
        select: {
          id: true,
          customerName: true,
        },
      },
    },
  });

  if (!assignment) return null;
  return mapAssignmentForBoard(assignment);
}

export async function getPlatformReservationUnitDeltaTx(
  tx: Tx,
  reservationUnitId: string
): Promise<PlatformReservationUnitDelta | null> {
  const unit = await tx.reservationUnit.findUnique({
    where: { id: reservationUnitId },
    select: {
      id: true,
      reservationId: true,
      status: true,
      readyForPlatformAt: true,
      jetskiId: true,
      serviceCategory: true,
      serviceName: true,
      durationMinutesSnapshot: true,
      quantitySnapshot: true,
      paxSnapshot: true,
      reservation: {
        select: {
          id: true,
          status: true,
          customerName: true,
          isLicense: true,
        },
      },
    },
  });

  if (!unit) return null;

  return {
    id: unit.id,
    reservationId: unit.reservationId,
    status: unit.status,
    readyForPlatformAt: iso(unit.readyForPlatformAt),
    jetskiId: unit.jetskiId,
    serviceCategory: unit.serviceCategory,
    serviceName: unit.serviceName,
    durationMinutesSnapshot: unit.durationMinutesSnapshot,
    quantitySnapshot: unit.quantitySnapshot,
    paxSnapshot: unit.paxSnapshot,
    reservation: unit.reservation,
  };
}

export async function getPlatformReservationDeltaTx(
  tx: Tx,
  reservationId: string
): Promise<PlatformReservationDelta | null> {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      readyForPlatformAt: true,
      departureAt: true,
      arrivalAt: true,
    },
  });

  if (!reservation) return null;

  return {
    id: reservation.id,
    status: reservation.status,
    readyForPlatformAt: iso(reservation.readyForPlatformAt),
    departureAt: iso(reservation.departureAt),
    arrivalAt: iso(reservation.arrivalAt),
  };
}

export async function getPlatformJetskiDeltaTx(
  tx: Tx,
  jetskiId: string
): Promise<JetskiAvail | null> {
  const jetski = await tx.jetski.findUnique({
    where: { id: jetskiId },
    select: {
      id: true,
      number: true,
      model: true,
      year: true,
      currentHours: true,
      status: true,
      operabilityStatus: true,
      maintenanceEvents: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "EXTERNAL"] } },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
      incidents: {
        where: { isOpen: true },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!jetski) return null;

  const activeMaintenanceEventId = jetski.maintenanceEvents?.[0]?.id ?? null;
  const activeIncidentId = jetski.incidents?.[0]?.id ?? null;

  return {
    id: jetski.id,
    number: jetski.number,
    model: jetski.model,
    year: jetski.year,
    currentHours: jetski.currentHours,
    status: jetski.status,
    operabilityStatus: jetski.operabilityStatus,
    activeMaintenanceEventId,
    activeIncidentId,
    blockReason: platformAssignmentBlockingReason({
      operabilityStatus: jetski.operabilityStatus,
      hasOpenMaintenanceEvent: Boolean(activeMaintenanceEventId),
      hasOpenIncident: Boolean(activeIncidentId),
    }),
  };
}

export async function getPlatformAssetDeltaTx(
  tx: Tx,
  assetId: string
): Promise<AssetAvail | null> {
  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      platformUsage: true,
      model: true,
      year: true,
      plate: true,
      status: true,
      operabilityStatus: true,
      note: true,
      currentHours: true,
      maintenanceEvents: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "EXTERNAL"] } },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
      incidents: {
        where: { isOpen: true },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!asset) return null;

  const activeMaintenanceEventId = asset.maintenanceEvents?.[0]?.id ?? null;
  const activeIncidentId = asset.incidents?.[0]?.id ?? null;

  return {
    id: asset.id,
    name: asset.name,
    code: asset.code,
    type: asset.type,
    platformUsage: asset.platformUsage,
    model: asset.model,
    year: asset.year,
    plate: asset.plate,
    status: asset.status,
    operabilityStatus: asset.operabilityStatus,
    note: asset.note,
    currentHours: asset.currentHours,
    activeMaintenanceEventId,
    activeIncidentId,
    blockReason: platformAssignmentBlockingReason({
      operabilityStatus: asset.operabilityStatus,
      hasOpenMaintenanceEvent: Boolean(activeMaintenanceEventId),
      hasOpenIncident: Boolean(activeIncidentId),
    }),
  };
}

export async function getPlatformOperabilitySummaryTx(tx: Tx): Promise<OperabilitySummary> {
  const [jetskis, assets] = await Promise.all([
    tx.jetski.groupBy({
      by: ["operabilityStatus"],
      _count: true,
    }),
    tx.asset.groupBy({
      by: ["operabilityStatus"],
      _count: true,
    }),
  ]);

  return { jetskis, assets };
}

export async function buildPlatformMutationDeltaTx(
  tx: Tx,
  params: {
    mutation: PlatformMutationName;
    runId?: string | null;
    assignmentIds?: string[];
    removedAssignmentIds?: string[];
    reservationUnitIds?: string[];
    reservationIds?: string[];
    jetskiIds?: string[];
    assetIds?: string[];
    removedQueueUnitIds?: string[];
    removedRunIds?: string[];
    includeOperability?: boolean;
  }
): Promise<PlatformMutationDelta> {
  const run = params.runId ? await getPlatformRunForBoardTx(tx, params.runId) : null;
  const assignments = (
    await Promise.all((params.assignmentIds ?? []).map((id) => getPlatformAssignmentForBoardTx(tx, id)))
  ).filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);
  const reservationUnits = (
    await Promise.all((params.reservationUnitIds ?? []).map((id) => getPlatformReservationUnitDeltaTx(tx, id)))
  ).filter((unit): unit is PlatformReservationUnitDelta => unit !== null);
  const reservations = (
    await Promise.all((params.reservationIds ?? []).map((id) => getPlatformReservationDeltaTx(tx, id)))
  ).filter((reservation): reservation is PlatformReservationDelta => reservation !== null);
  const jetskis = (
    await Promise.all((params.jetskiIds ?? []).map((id) => getPlatformJetskiDeltaTx(tx, id)))
  ).filter((jetski): jetski is JetskiAvail => jetski !== null);
  const assets = (
    await Promise.all((params.assetIds ?? []).map((id) => getPlatformAssetDeltaTx(tx, id)))
  ).filter((asset): asset is AssetAvail => asset !== null);
  const queueItems = reservationUnits
    .map(mapQueueItemFromUnit)
    .filter((item): item is QueueItem => item !== null);

  return {
    mutation: params.mutation,
    runId: params.runId ?? null,
    run,
    assignments,
    removedAssignmentIds: params.removedAssignmentIds ?? [],
    reservationUnits,
    reservations,
    queueItems,
    removedQueueUnitIds: params.removedQueueUnitIds ?? [],
    removedRunIds: params.removedRunIds ?? [],
    jetskis,
    assets,
    operability: params.includeOperability ? await getPlatformOperabilitySummaryTx(tx) : null,
  };
}

