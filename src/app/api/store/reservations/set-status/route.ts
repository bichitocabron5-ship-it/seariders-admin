/// src/app/api/store/reservations/set-status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { MonitorRunStatus, ReservationUnitStatus, RunAssignmentStatus, type Prisma } from "@prisma/client";
import { computeRequiredPlatformUnits } from "@/lib/reservation-rules";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { evaluateReadyForPlatform } from "@/lib/ready-for-platform";

export const runtime = "nodejs";

const ALLOWED_MANUAL_STATUSES = new Set(["SCHEDULED", "WAITING", "READY_FOR_PLATFORM"] as const);

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(["SCHEDULED", "WAITING", "READY_FOR_PLATFORM", "IN_SEA", "COMPLETED", "CANCELED"]),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

type ItemForUnits = { quantity: number | null; isExtra: boolean; service: { category: string | null } | null };
type UnitIndex = { unitIndex: number };

async function ensureUnitsTx(tx: Prisma.TransactionClient, reservationId: string) {
  const r = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      readyForPlatformAt: true,
      quantity: true,
      isPackParent: true,
      parentReservationId: true,
      isLicense: true,
      service: { select: { category: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true } },
        },
      },
    },
  });
  if (!r) return;
  if (r.isPackParent && !r.parentReservationId) return;

  const requiredUnits = computeRequiredPlatformUnits({
    quantity: r.quantity,
    serviceCategory: r.service?.category ?? null,
    items: (r.items ?? []).map((it): ItemForUnits => ({
      quantity: it.quantity ?? 0,
      isExtra: Boolean(it.isExtra),
      service: it.service ? { category: it.service.category ?? null } : null,
    })),
  });
  if (requiredUnits <= 0) return;

  const existing = await tx.reservationUnit.findMany({
    where: { reservationId: r.id },
    select: { unitIndex: true },
  });
  const set = new Set(existing.map((u: UnitIndex) => Number(u.unitIndex)));

  const toCreate: Array<{ reservationId: string; unitIndex: number; readyForPlatformAt?: Date }> = [];
  for (let i = 1; i <= requiredUnits; i++) {
    if (!set.has(i)) {
      toCreate.push({
        reservationId: r.id,
        unitIndex: i,
        ...(r.status === "READY_FOR_PLATFORM" && r.readyForPlatformAt ? { readyForPlatformAt: r.readyForPlatformAt } : {}),
      });
    }
  }
  if (toCreate.length > 0) await tx.reservationUnit.createMany({ data: toCreate, skipDuplicates: true });
}

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        status: true,
        paymentCompletedAt: true,
        formalizedAt: true,
        totalPriceCents: true,
        depositCents: true,
        quantity: true,
        isLicense: true,
        service: { select: { category: true } },
        items: {
          select: {
            quantity: true,
            isExtra: true,
            service: { select: { category: true } },
          },
        },
        contracts: { select: { unitIndex: true, status: true } },
        payments: { select: { amountCents: true, isDeposit: true, direction: true } },
      },
    });
    if (!current) throw new Error("Reserva no existe");
    if (!ALLOWED_MANUAL_STATUSES.has(parsed.data.status)) {
      throw new Error("Este endpoint no permite forzar IN_SEA, COMPLETED o CANCELED. Usa el flujo operativo específico.");
    }

    const openAssignments = await tx.monitorRunAssignment.count({
      where: {
        reservationId: parsed.data.id,
        status: { in: [RunAssignmentStatus.QUEUED, RunAssignmentStatus.ACTIVE] },
        run: {
          status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
        },
      },
    });

    const readyAt = parsed.data.status === "READY_FOR_PLATFORM" ? new Date() : null;
    if (parsed.data.status === "READY_FOR_PLATFORM") {
      const readyCheck = evaluateReadyForPlatform({
        status: current.status,
        formalizedAt: current.formalizedAt,
        totalPriceCents: current.totalPriceCents,
        depositCents: current.depositCents,
        quantity: current.quantity,
        isLicense: Boolean(current.isLicense),
        service: current.service,
        items: (current.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
        contracts: (current.contracts ?? []).map((contract) => ({
          unitIndex: Number(contract.unitIndex ?? 0),
          status: contract.status,
        })),
        payments: (current.payments ?? []).map((payment) => ({
          amountCents: Number(payment.amountCents ?? 0),
          isDeposit: Boolean(payment.isDeposit),
          direction: payment.direction,
        })),
      });
      if (!readyCheck.ok) throw new Error(readyCheck.error);
    }
    if ((parsed.data.status === "WAITING" || parsed.data.status === "SCHEDULED") && openAssignments > 0) {
      throw new Error("La reserva tiene asignaciones activas o en cola en Platform. Deshaz la asignación antes de cambiar el estado.");
    }

    await tx.reservation.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        ...(readyAt ? { paymentCompletedAt: current.paymentCompletedAt ?? readyAt } : {}),
        readyForPlatformAt: readyAt,
      },
      select: { id: true },
    });

    if (parsed.data.status === "READY_FOR_PLATFORM") {
      await ensureUnitsTx(tx, parsed.data.id);
      await tx.reservationUnit.updateMany({
        where: { reservationId: parsed.data.id, status: "READY_FOR_PLATFORM" },
        data: { readyForPlatformAt: readyAt ?? undefined },
      });
    }
    if (parsed.data.status === "WAITING" || parsed.data.status === "SCHEDULED") {
      await tx.reservationUnit.updateMany({
        where: {
          reservationId: parsed.data.id,
          status: ReservationUnitStatus.READY_FOR_PLATFORM,
        },
        data: {
          status: ReservationUnitStatus.WAITING,
          readyForPlatformAt: null,
          jetskiId: null,
        },
      });
    }

    await syncStoreFulfillmentTasksForReservation(tx, parsed.data.id);
  });

  return NextResponse.json({ ok: true });
}
