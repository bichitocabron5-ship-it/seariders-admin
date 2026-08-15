/// src/app/api/store/reservations/set-status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { MonitorRunStatus, ReservationUnitStatus, RunAssignmentStatus } from "@prisma/client";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { evaluateReadyForPlatform } from "@/lib/ready-for-platform";
import { ensureReservationPlatformUnitsTx } from "@/lib/reservation-platform";

export const runtime = "nodejs";

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(["SCHEDULED", "WAITING", "READY_FOR_PLATFORM", "IN_SEA", "COMPLETED", "CANCELED"]),
});

const ALLOWED_MANUAL_STATUSES = ["SCHEDULED", "WAITING", "READY_FOR_PLATFORM"] as const;
type AllowedManualStatus = (typeof ALLOWED_MANUAL_STATUSES)[number];

function isAllowedManualStatus(status: z.infer<typeof Body>["status"]): status is AllowedManualStatus {
  return (ALLOWED_MANUAL_STATUSES as readonly string[]).includes(status);
}

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
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
        serviceId: true,
        optionId: true,
        pax: true,
        isLicense: true,
        isPackParent: true,
        parentReservationId: true,
        service: { select: { name: true, category: true } },
        option: { select: { durationMinutes: true } },
        items: {
          select: {
            id: true,
            serviceId: true,
            optionId: true,
            quantity: true,
            pax: true,
            totalPriceCents: true,
            isExtra: true,
            isPackParent: true,
            service: { select: { name: true, category: true } },
            option: { select: { durationMinutes: true } },
          },
        },
        contracts: { select: { id: true, reservationItemId: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true } },
        payments: { select: { amountCents: true, isDeposit: true, direction: true } },
      },
    });
    if (!current) throw new Error("Reserva no existe");
    if (!isAllowedManualStatus(parsed.data.status)) {
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
        serviceId: current.serviceId,
        optionId: current.optionId,
        pax: current.pax,
        isLicense: Boolean(current.isLicense),
        service: current.service,
        option: current.option,
        items: (current.items ?? []).map((it) => ({
          id: it.id,
          serviceId: it.serviceId,
          optionId: it.optionId,
          quantity: it.quantity ?? 0,
          pax: it.pax,
          isExtra: Boolean(it.isExtra),
          isPackParent: Boolean(it.isPackParent),
          totalPriceCents: it.totalPriceCents,
          service: it.service ? { name: it.service.name ?? null, category: it.service.category ?? null } : null,
          option: it.option ? { durationMinutes: it.option.durationMinutes ?? null } : null,
        })),
        contracts: (current.contracts ?? []).map((contract) => ({
          id: contract.id,
          reservationItemId: contract.reservationItemId,
          unitIndex: Number(contract.unitIndex ?? 0),
          logicalUnitIndex: contract.logicalUnitIndex ?? null,
          status: contract.status,
          supersededAt: contract.supersededAt ?? null,
          createdAt: contract.createdAt ?? null,
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
      await ensureReservationPlatformUnitsTx(tx, {
        id: current.id,
        quantity: current.quantity,
        isPackParent: current.isPackParent,
        parentReservationId: current.parentReservationId,
        serviceCategory: current.service?.category ?? null,
        items: (current.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
      }, readyAt ?? undefined);
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
