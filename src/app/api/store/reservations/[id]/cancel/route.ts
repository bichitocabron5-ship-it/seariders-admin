import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ExtraTimeStatus,
  MonitorRunStatus,
  PaymentMethod,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
  ReservationUnitStatus,
  RoleName,
  RunAssignmentStatus,
} from "@prisma/client";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";

export const runtime = "nodejs";

const Body = z.object({
  refundMode: z.enum(["NONE", "SERVICE", "FULL"]).default("NONE"),
  refundMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  refundOrigin: z.nativeEnum(PaymentOrigin).default(PaymentOrigin.STORE),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role !== "STORE" && session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const body = parsed.data;
  const userId = session.userId as string;

  if (body.refundMode !== "NONE") {
    await assertCashOpenForUser(userId, session.role as RoleName);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          status: true,
          arrivedStoreAt: true,
          depositHeld: true,
          depositHoldReason: true,
          payments: {
            select: {
              amountCents: true,
              isDeposit: true,
              direction: true,
            },
          },
        },
      });

      if (!reservation) {
        throw Object.assign(new Error("Reserva no existe"), { status: 404 });
      }

      if (reservation.status === ReservationStatus.CANCELED) {
        return {
          ok: true as const,
          alreadyCanceled: true,
          refundedServiceCents: 0,
          refundedDepositCents: 0,
        };
      }

      if (reservation.status === ReservationStatus.COMPLETED) {
        throw Object.assign(new Error("No se puede cancelar una reserva completada"), { status: 409 });
      }

      if (reservation.status === ReservationStatus.IN_SEA) {
        throw Object.assign(
          new Error("Una reserva en el mar no se puede cancelar ni devolver desde tienda"),
          { status: 409 }
        );
      }

      if (reservation.source === ReservationSource.BOOTH && !reservation.arrivedStoreAt) {
        throw Object.assign(
          new Error("La reserva sigue en carpa. Cancélala desde BOOTH para no afectar la caja de STORE."),
          { status: 409 }
        );
      }

      const activeAssignments = await tx.monitorRunAssignment.count({
        where: {
          reservationId: id,
          status: RunAssignmentStatus.ACTIVE,
          run: {
            status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
          },
        },
      });

      if (activeAssignments > 0) {
        throw Object.assign(
          new Error("La reserva está activa en plataforma. Ciérrala o desasígnala antes de cancelarla."),
          { status: 409 }
        );
      }

      const queuedAssignments = await tx.monitorRunAssignment.findMany({
        where: {
          reservationId: id,
          status: RunAssignmentStatus.QUEUED,
          run: {
            status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
          },
        },
        select: { id: true },
      });

      if (queuedAssignments.length > 0) {
        await tx.monitorRunAssignment.deleteMany({
          where: { id: { in: queuedAssignments.map((a) => a.id) } },
        });
      }

      const netServicePaidCents = reservation.payments
        .filter((p) => !p.isDeposit)
        .reduce((sum, p) => sum + (p.direction === "OUT" ? -1 : 1) * p.amountCents, 0);

      const netDepositPaidCents = reservation.payments
        .filter((p) => p.isDeposit)
        .reduce((sum, p) => sum + (p.direction === "OUT" ? -1 : 1) * p.amountCents, 0);

      const refundableServiceCents = Math.max(0, netServicePaidCents);
      const refundableDepositCents = Math.max(0, netDepositPaidCents);

      let refundedServiceCents = 0;
      let refundedDepositCents = 0;

      if (body.refundMode === "SERVICE" || body.refundMode === "FULL") {
        refundedServiceCents = refundableServiceCents;
      }

      if (body.refundMode === "FULL") {
        if (reservation.depositHeld) {
          throw Object.assign(
            new Error(
              `La fianza está retenida${reservation.depositHoldReason ? `: ${reservation.depositHoldReason}` : ""}`
            ),
            { status: 409 }
          );
        }
        refundedDepositCents = refundableDepositCents;
      }

      if (refundedServiceCents > 0) {
        await tx.payment.create({
          data: {
            reservationId: id,
            origin: body.refundOrigin,
            method: body.refundMethod,
            amountCents: refundedServiceCents,
            isDeposit: false,
            direction: "OUT",
          },
        });
      }

      if (refundedDepositCents > 0) {
        await tx.payment.create({
          data: {
            reservationId: id,
            origin: body.refundOrigin,
            method: body.refundMethod,
            amountCents: refundedDepositCents,
            isDeposit: true,
            direction: "OUT",
          },
        });
      }

      await tx.extraTimeEvent.updateMany({
        where: {
          reservationId: id,
          status: ExtraTimeStatus.PENDING,
        },
        data: { status: ExtraTimeStatus.VOIDED },
      });

      await tx.reservationUnit.updateMany({
        where: { reservationId: id },
        data: {
          status: ReservationUnitStatus.CANCELED,
          jetskiId: null,
          readyForPlatformAt: null,
        },
      });

      await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELED,
          taxiboatTripId: null,
          taxiboatAssignedAt: null,
          readyForPlatformAt: null,
        },
      });

      await syncStoreFulfillmentTasksForReservation(tx, id);

      return {
        ok: true as const,
        alreadyCanceled: false,
        refundedServiceCents,
        refundedDepositCents,
      };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? ((error as { status: number }).status)
        : 500;

    const message = error instanceof Error ? error.message : "No se pudo cancelar la reserva";
    return NextResponse.json({ error: message }, { status });
  }
}
