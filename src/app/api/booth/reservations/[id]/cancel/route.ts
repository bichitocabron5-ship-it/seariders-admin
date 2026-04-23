import { NextResponse } from "next/server";
import {
  PaymentDirection,
  PaymentMethod,
  PaymentOrigin,
  ReservationStatus,
  ReservationUnitStatus,
  RoleName,
} from "@prisma/client";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireBoothOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role !== "BOOTH" && session.role !== "ADMIN") return null;
  return session;
}

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireBoothOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  try {
    const shiftSession = await findCurrentShiftSession({
      userId: session.userId as string,
      role: RoleName.BOOTH,
      shiftSessionId: session.shiftSessionId,
    });

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          status: true,
          arrivedStoreAt: true,
          payments: {
            select: {
              id: true,
              amountCents: true,
              isDeposit: true,
              direction: true,
              method: true,
              origin: true,
            },
          },
          taxiboatTrip: {
            select: {
              status: true,
              departedAt: true,
            },
          },
        },
      });

      if (!reservation || reservation.source !== "BOOTH") {
        throw Object.assign(new Error("Reserva no válida"), { status: 404 });
      }

      if (reservation.status === ReservationStatus.CANCELED) {
        return { ok: true as const, alreadyCanceled: true };
      }

      if (reservation.status === ReservationStatus.COMPLETED) {
        throw Object.assign(new Error("No se puede cancelar una reserva completada"), { status: 409 });
      }

      if (reservation.status === ReservationStatus.IN_SEA || reservation.arrivedStoreAt) {
        throw Object.assign(new Error("La reserva ya está en operación o recibida en tienda"), { status: 409 });
      }

      if (
        reservation.taxiboatTrip &&
        (reservation.taxiboatTrip.departedAt || reservation.taxiboatTrip.status !== "OPEN")
      ) {
        throw Object.assign(new Error("La reserva ya salió. No se puede cancelar desde carpa"), { status: 409 });
      }

      const boothServicePaidByMethod = reservation.payments.reduce<Record<string, number>>((acc, payment) => {
        if (payment.origin !== PaymentOrigin.BOOTH || payment.isDeposit) return acc;
        const sign = payment.direction === PaymentDirection.OUT ? -1 : 1;
        acc[payment.method] = (acc[payment.method] ?? 0) + sign * Number(payment.amountCents ?? 0);
        return acc;
      }, {});

      const refundableServiceEntries = Object.entries(boothServicePaidByMethod)
        .map(([method, amountCents]) => ({
          method,
          amountCents: Math.max(0, Number(amountCents ?? 0)),
        }))
        .filter((entry) => entry.amountCents > 0);

      const refundableServiceCents = refundableServiceEntries.reduce((sum, entry) => sum + entry.amountCents, 0);

      if (refundableServiceCents > 0) {
        await assertCashOpenForUser(
          session.userId as string,
          RoleName.BOOTH,
          session.shiftSessionId
        );

        await tx.payment.createMany({
          data: refundableServiceEntries.map((entry) => ({
            reservationId: id,
            origin: PaymentOrigin.BOOTH,
            method: entry.method as PaymentMethod,
            amountCents: entry.amountCents,
            isDeposit: false,
            direction: PaymentDirection.OUT,
            createdByUserId: session.userId as string,
            shiftSessionId: shiftSession?.id ?? null,
            notes: `CANCELACION BOOTH ${id}`,
          })),
        });
      }

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

      return {
        ok: true as const,
        alreadyCanceled: false,
        refundedServiceCents: refundableServiceCents,
      };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500;

    const message = error instanceof Error ? error.message : "No se pudo cancelar la reserva";
    return NextResponse.json({ error: message }, { status });
  }
}
