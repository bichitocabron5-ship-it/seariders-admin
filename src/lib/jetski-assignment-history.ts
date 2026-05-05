type AssignmentLike = {
  id: string;
  reservationId: string;
  reservationUnitId?: string | null;
  status: string;
  createdAt: Date;
  startedAt?: Date | null;
  expectedEndAt?: Date | null;
  endedAt?: Date | null;
  jetskiId?: string | null;
  jetski?: {
    id: string;
    number?: number | null;
  } | null;
};

type UnitLike = {
  id: string;
  unitIndex?: number | null;
  jetskiId?: string | null;
  jetski?: {
    id: string;
    number?: number | null;
  } | null;
};

export type ReservationJetskiAssignmentSummary = {
  assignmentId: string | null;
  reservationId: string;
  reservationUnitId: string | null;
  unitIndex: number | null;
  jetskiId: string;
  jetskiNumber: number | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  expectedEndAt: Date | null;
  returnedAt: Date | null;
  status: string;
  source: "ASSIGNMENT" | "LEGACY_UNIT";
};

export function buildReservationJetskiAssignments(args: {
  reservationId: string;
  assignments?: AssignmentLike[] | null;
  units?: UnitLike[] | null;
}): ReservationJetskiAssignmentSummary[] {
  const rows: ReservationJetskiAssignmentSummary[] = [];
  const seen = new Set<string>();

  for (const assignment of args.assignments ?? []) {
    if (!assignment.jetskiId) continue;
    const key = `${assignment.id}:${assignment.jetskiId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      assignmentId: assignment.id,
      reservationId: args.reservationId,
      reservationUnitId: assignment.reservationUnitId ?? null,
      unitIndex:
        (args.units ?? []).find((unit) => unit.id === assignment.reservationUnitId)?.unitIndex ?? null,
      jetskiId: assignment.jetskiId,
      jetskiNumber: assignment.jetski?.number ?? null,
      assignedAt: assignment.createdAt ?? null,
      startedAt: assignment.startedAt ?? null,
      expectedEndAt: assignment.expectedEndAt ?? null,
      returnedAt: assignment.endedAt ?? null,
      status: assignment.status,
      source: "ASSIGNMENT",
    });
  }

  for (const unit of args.units ?? []) {
    if (!unit.jetskiId) continue;
    const key = `legacy:${unit.id}:${unit.jetskiId}`;
    const alreadyCovered = rows.some(
      (row) =>
        row.reservationUnitId === unit.id &&
        row.jetskiId === unit.jetskiId
    );
    if (seen.has(key) || alreadyCovered) continue;
    seen.add(key);

    rows.push({
      assignmentId: null,
      reservationId: args.reservationId,
      reservationUnitId: unit.id,
      unitIndex: unit.unitIndex ?? null,
      jetskiId: unit.jetskiId,
      jetskiNumber: unit.jetski?.number ?? null,
      assignedAt: null,
      startedAt: null,
      expectedEndAt: null,
      returnedAt: null,
      status: "LEGACY",
      source: "LEGACY_UNIT",
    });
  }

  return rows.sort((a, b) => {
    const at = a.assignedAt?.getTime() ?? a.startedAt?.getTime() ?? 0;
    const bt = b.assignedAt?.getTime() ?? b.startedAt?.getTime() ?? 0;
    return at - bt;
  });
}
