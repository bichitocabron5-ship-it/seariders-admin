import { NextResponse } from "next/server";
import { ReservationStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

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
              amountCents: true,
              isDeposit: true,
              direction: true,
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

      const paidServiceCents = reservation.payments
        .filter((payment) => !payment.isDeposit)
        .reduce((sum, payment) => {
          const sign = payment.direction === "OUT" ? -1 : 1;
          return sum + sign * Number(payment.amountCents ?? 0);
        }, 0);

      if (paidServiceCents > 0) {
        throw Object.assign(
          new Error("La reserva tiene cobros registrados. Gestiona la devolución antes de cancelarla."),
          { status: 409 }
        );
      }

      await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELED,
          taxiboatTripId: null,
          taxiboatAssignedAt: null,
          readyForPlatformAt: null,
        },
      });

      return { ok: true as const, alreadyCanceled: false };
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
