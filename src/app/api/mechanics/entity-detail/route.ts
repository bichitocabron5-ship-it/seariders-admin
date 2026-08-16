// src/app/api/mechanics/entity-detail/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MaintenanceEntityType, RunAssignmentStatus } from "@prisma/client";
import { applyLiveHours, calcService, diffHours, isServiceEventType } from "@/lib/mechanics";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";
import { getActiveTaxiboatHoursMap } from "@/lib/taxiboat-mechanics";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { resolveReservationUnitActivity } from "@/lib/reservation-unit-activity";

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

function withResolvedAssignmentActivity<
  T extends {
    reservationUnit: {
      unitIndex: number | null;
      reservationItemId?: string | null;
      serviceId?: string | null;
      optionId?: string | null;
      serviceName?: string | null;
      serviceCategory?: string | null;
      durationMinutesSnapshot?: number | null;
      quantitySnapshot?: number | null;
      paxSnapshot?: number | null;
    } | null;
    reservation: {
      quantity?: number | null;
      pax?: number | null;
      service?: {
        id?: string | null;
        name?: string | null;
        category?: string | null;
      } | null;
      option?: {
        id?: string | null;
        durationMinutes?: number | null;
      } | null;
    };
  }
>(assignment: T) {
  const activity = resolveReservationUnitActivity({
    unit: assignment.reservationUnit,
    legacyReservation: assignment.reservation,
  });

  return {
    ...assignment,
    activity,
    reservation: {
      ...assignment.reservation,
      service: {
        id: activity.serviceId,
        name: activity.serviceName,
        category: activity.serviceCategory,
      },
      option: {
        id: activity.optionId,
        durationMinutes: activity.durationMinutes,
      },
    },
  };
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

  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);
  const assignmentUsage = await prisma.monitorRunAssignment.findMany({
    where: {
      jetskiId: entityId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      expectedEndAt: true,
      endedAt: true,
      reservationId: true,
      reservationUnitId: true,
      reservationUnit: {
        select: {
          unitIndex: true,
          reservationItemId: true,
          serviceId: true,
          optionId: true,
          serviceName: true,
          serviceCategory: true,
          durationMinutesSnapshot: true,
          quantitySnapshot: true,
          paxSnapshot: true,
        },
      },
      reservation: {
        select: {
          id: true,
          status: true,
          customerName: true,
          customerCountry: true,
          activityDate: true,
          scheduledTime: true,
          quantity: true,
          pax: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true } },
        },
      },
    },
  });
  const assignmentsToday = assignmentUsage.filter((assignment) => {
    const when =
      assignment.startedAt ??
      assignment.createdAt ??
      assignment.reservation.scheduledTime ??
      assignment.reservation.activityDate;
    return when >= start && when < endExclusive;
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
    assignmentsToday: assignmentsToday.map(withResolvedAssignmentActivity),
    recentAssignments: assignmentUsage.map(withResolvedAssignmentActivity),
  };
}

async function getAssetDetail(entityId: string, take: number) {
  const entity = await prisma.asset.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      type: true,
      maintenanceProfile: true,
      meterType: true,
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

  const usesHours = entity.meterType === "HOURS";
  const lastEvt = usesHours
    ? events.find((event) => isServiceEventType(event.type)) ?? null
    : null;
  const lastServiceHoursEffective = usesHours
    ? lastEvt?.hoursAtService ?? (entity.lastServiceHours ?? null)
    : null;
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
  const taxiboatOperations = await prisma.taxiboatOperation.findMany({
    where: {
      status: {
        in: ["TO_PLATFORM", "TO_BOOTH"],
      },
    },
    select: {
      boat: true,
      status: true,
      departedBoothAt: true,
      departedPlatformAt: true,
    },
  });
  const now = new Date();
  const assignmentHours = activeAssignments.reduce(
    (acc, assignment) =>
      acc + (assignment.startedAt ? diffHours(assignment.startedAt, now) : 0),
    0
  );
  const taxiboatHours =
    getActiveTaxiboatHoursMap({
      assets: [{ id: entity.id, name: entity.name, code: entity.code ?? null }],
      operations: taxiboatOperations,
      now,
    }).get(entity.id) ?? 0;
  const currentHoursEffective = usesHours
    ? applyLiveHours(entity.currentHours ?? null, assignmentHours + taxiboatHours)
    : null;

  const service = calcService({
    currentHours: currentHoursEffective,
    lastServiceHours: lastServiceHoursEffective,
    serviceIntervalHours: Number(entity.serviceIntervalHours ?? 85),
    serviceWarnHours: Number(entity.serviceWarnHours ?? 70),
  });

  const assignmentUsage = await prisma.monitorRunAssignment.findMany({
    where: {
      assetId: entityId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      expectedEndAt: true,
      endedAt: true,
      reservationId: true,
      reservationUnitId: true,
      reservationUnit: {
        select: {
          unitIndex: true,
          reservationItemId: true,
          serviceId: true,
          optionId: true,
          serviceName: true,
          serviceCategory: true,
          durationMinutesSnapshot: true,
          quantitySnapshot: true,
          paxSnapshot: true,
        },
      },
      reservation: {
        select: {
          id: true,
          status: true,
          customerName: true,
          customerCountry: true,
          activityDate: true,
          scheduledTime: true,
          quantity: true,
          pax: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true } },
        },
      },
    },
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
    assignmentsToday: [],
    recentAssignments: assignmentUsage.map(withResolvedAssignmentActivity),
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
