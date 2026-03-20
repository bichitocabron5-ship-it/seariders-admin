// src/app/api/store/reservations/[id]/complete-return/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationStatus, ReservationUnitStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function POST(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const reservationId = id;

  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1
        FROM "Reservation"
        WHERE "id" = ${reservationId}
        FOR UPDATE
      `;

      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          status: true,
          arrivalAt: true,
          depositHeld: true,
          depositCents: true,
          payments: {
            select: {
              id: true,
              isDeposit: true,
              direction: true,
              amountCents: true,
            },
          },
          units: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new Error("Reserva no existe");
      }

      if (reservation.status !== ReservationStatus.WAITING || !reservation.arrivalAt) {
        throw new Error("La reserva no está en estado de devolución pendiente de cierre");
      }

      const depositInCents = reservation.payments
        .filter((p) => p.isDeposit && p.direction !== "OUT")
        .reduce((acc, p) => acc + Number(p.amountCents ?? 0), 0);

      const depositOutCents = reservation.payments
        .filter((p) => p.isDeposit && p.direction === "OUT")
        .reduce((acc, p) => acc + Number(p.amountCents ?? 0), 0);

      const refundableDepositCents = Math.max(0, depositInCents - depositOutCents);

      const depositResolved =
        reservation.depositHeld === true || refundableDepositCents === 0;

      if (!depositResolved) {
        throw new Error(
          "La fianza aún no está resuelta. Debes devolverla o dejarla retenida antes de cerrar."
        );
      }

      await tx.reservationUnit.updateMany({
        where: {
          reservationId: reservation.id,
          status: {
            in: [
              ReservationUnitStatus.WAITING,
              ReservationUnitStatus.READY_FOR_PLATFORM,
              ReservationUnitStatus.IN_SEA,
            ],
          },
        },
        data: {
          status: ReservationUnitStatus.COMPLETED,
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.COMPLETED,
        },
        select: { id: true },
      });

      return {
        ok: true,
        reservationId: reservation.id,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}