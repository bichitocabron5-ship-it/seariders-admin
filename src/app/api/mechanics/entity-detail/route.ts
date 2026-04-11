// src/app/api/mechanics/entity-detail/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MaintenanceEntityType, RunAssignmentStatus } from "@prisma/client";
import { applyLiveHours, calcService, diffHours, isServiceEventType } from "@/lib/mechanics";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Query = z.object({
  entityType: z.nativeEnum(MaintenanceEntityType),
  entityId: z.string().min(1),
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
});

function withPartUsageSummary<
  T extends {
    partUsages: Array<{
      id: string;
      qty: number | null;
      unitCostCents: number | null;
      totalCostCents: number | null;
      createdAt: Date;
      sparePart: {
        id: string;
        name: string;
        sku: string | null;
        unit: string | null;
      } | null;
    }>;
  }
>(events: T[]) {
  return events.map((event) => {
    const partUsageSummary = event.partUsages.reduce(
      (acc, usage) => {
        acc.count += 1;
        acc.totalQty += Number(usage.qty ?? 0);
        acc.totalCostCents += Number(usage.totalCostCents ?? 0);
        return acc;
      },
      {
        count: 0,
        totalQty: 0,
        totalCostCents: 0,
      }
    );

    return {
      ...event,
      partUsageSummary,
    };
  });
}

async function getJetskiDetail(entityId: string, take: number) {
  const entity = await prisma.jetski.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      number: true,
      plate: true,
      chassisNumber: true,
      model: true,
      year: true,
      owner: true,
      maxPax: true,
      status: true,
      currentHours: true,
      lastServiceHours: true,
      serviceIntervalHours: true,
      serviceWarnHours: true,
      createdAt: true,
      updatedAt: true,
      operabilityStatus: true,
    },
  });

  if (!entity) {
    return null;
  }

  const rawEvents = await prisma.maintenanceEvent.findMany({
    where: {
      entityType: MaintenanceEntityType.JETSKI,
      jetskiId: entityId,
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      entityType: true,
      type: true,
      hoursAtService: true,
      note: true,
      createdAt: true,
      createdByUserId: true,
      severity: true,
      status: true,
      supplierName: true,
      externalWorkshop: true,
      costCents: true,
      laborCostCents: true,
      partsCostCents: true,
      resolvedAt: true,
      faultCode: true,
      reopenCount: true,
      incident: {
        select: {
          id: true,
          type: true,
          level: true,
          status: true,
          isOpen: true,
          description: true,
          notes: true,
          runId: true,
          assignmentId: true,
          reservationUnitId: true,
          createdAt: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
        },
      },
      partUsages: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          sparePart: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      },
    },
  });

  const events = withPartUsageSummary(rawEvents);

  const lastEvt = events.find((event) => isServiceEventType(event.type)) ?? null;
  const lastServiceHoursEffective =
    lastEvt?.hoursAtService ?? (entity.lastServiceHours ?? null);
  const activeAssignments = await prisma.monitorRunAssignment.findMany({
    where: {
      status: RunAssignmentStatus.ACTIVE,
      endedAt: null,
      startedAt: { not: null },
      jetskiId: entityId,
    },
    select: {
      startedAt: true,
    },
  });
  const now = new Date();
  const activeHours = activeAssignments.reduce(
    (acc, assignment) =>
      acc + (assignment.startedAt ? diffHours(assignment.startedAt, now) : 0),
    0
  );
  const currentHoursEffective = applyLiveHours(entity.currentHours ?? null, activeHours);

  const service = calcService({
    currentHours: currentHoursEffective,
    lastServiceHours: lastServiceHoursEffective,
    serviceIntervalHours: Number(entity.serviceIntervalHours ?? 85),
    serviceWarnHours: Number(entity.serviceWarnHours ?? 70),
  });

  return {
    ok: true,
    entityType: MaintenanceEntityType.JETSKI,
    entity: {
      ...entity,
      currentHours: currentHoursEffective,
      displayName: `Moto ${entity.number}`,
    },
    service,
    lastServiceHoursEffective,
    lastEvent: lastEvt,
    events,
  };
}

async function getAssetDetail(entityId: string, take: number) {
  const entity = await prisma.asset.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      model: true,
      year: true,
      plate: true,
      chassisNumber: true,
      maxPax: true,
      note: true,
      status: true,
      isMotorized: true,
      currentHours: true,
      lastServiceHours: true,
      serviceIntervalHours: true,
      serviceWarnHours: true,
      createdAt: true,
      updatedAt: true,
      operabilityStatus: true,
    },
  });

  if (!entity) {
    return null;
  }

  const rawEvents = await prisma.maintenanceEvent.findMany({
    where: {
      entityType: MaintenanceEntityType.ASSET,
      assetId: entityId,
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      entityType: true,
      type: true,
      hoursAtService: true,
      note: true,
      createdAt: true,
      createdByUserId: true,
      severity: true,
      status: true,
      supplierName: true,
      externalWorkshop: true,
      costCents: true,
      laborCostCents: true,
      partsCostCents: true,
      resolvedAt: true,
      faultCode: true,
      reopenCount: true,
      incident: {
        select: {
          id: true,
          type: true,
          level: true,
          status: true,
          isOpen: true,
          description: true,
          notes: true,
          runId: true,
          assignmentId: true,
          reservationUnitId: true,
          createdAt: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
        },
      },
      partUsages: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          createdAt: true,
          sparePart: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      },
    },
  });

  const events = withPartUsageSummary(rawEvents);

  const lastEvt = events.find((event) => isServiceEventType(event.type)) ?? null;
  const lastServiceHoursEffective =
    lastEvt?.hoursAtService ?? (entity.lastServiceHours ?? null);
  const activeAssignments = await prisma.monitorRunAssignment.findMany({
    where: {
      status: RunAssignmentStatus.ACTIVE,
      endedAt: null,
      startedAt: { not: null },
      assetId: entityId,
    },
    select: {
      startedAt: true,
    },
  });
  const now = new Date();
  const activeHours = activeAssignments.reduce(
    (acc, assignment) =>
      acc + (assignment.startedAt ? diffHours(assignment.startedAt, now) : 0),
    0
  );
  const currentHoursEffective = applyLiveHours(entity.currentHours ?? null, activeHours);

  const service = calcService({
    currentHours: currentHoursEffective,
    lastServiceHours: lastServiceHoursEffective,
    serviceIntervalHours: Number(entity.serviceIntervalHours ?? 85),
    serviceWarnHours: Number(entity.serviceWarnHours ?? 70),
  });

  return {
    ok: true,
    entityType: MaintenanceEntityType.ASSET,
    entity: {
      ...entity,
      currentHours: currentHoursEffective,
      displayName: entity.name,
    },
    service,
    lastServiceHoursEffective,
    lastEvent: lastEvt,
    events,
  };
}

export async function GET(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    entityType: (url.searchParams.get("entityType") ?? "").toUpperCase(),
    entityId: url.searchParams.get("entityId") ?? "",
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { entityType, entityId, take } = parsed.data;

  if (entityType === MaintenanceEntityType.JETSKI) {
    const result = await getJetskiDetail(entityId, take);
    if (!result) {
      return new NextResponse("Jetski no existe", { status: 404 });
    }
    return NextResponse.json(result);
  }

  const result = await getAssetDetail(entityId, take);
  if (!result) {
    return new NextResponse("Asset no existe", { status: 404 });
  }

  return NextResponse.json(result);
}
