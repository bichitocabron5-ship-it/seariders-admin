import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { PaymentMethod, ReservationStatus, ReservationUnitStatus, RoleName } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";

export const runtime = "nodejs";

const Body = z.object({
  settlementMode: z
    .enum(["AUTO", "FULL_REFUND", "PARTIAL_REFUND", "RETAIN_ALL"])
    .optional()
    .default("AUTO"),
  refundAmountCents: z.coerce.number().int().min(0).optional().nullable(),
  refundMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  retainReason: z.string().trim().max(500).optional().nullable(),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions,
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new NextResponse("Body inválido", { status: 400 });
  }

  const body = parsed.data;
  const { id: reservationId } = await ctx.params;

  if (body.settlementMode === "FULL_REFUND" || body.settlementMode === "PARTIAL_REFUND") {
    await assertCashOpenForUser(session.userId!, session.role as RoleName);
  }

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
          depositHoldReason: true,
          payments: {
            select: {
              isDeposit: true,
              direction: true,
              amountCents: true,
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
        .filter((payment) => payment.isDeposit && payment.direction !== "OUT")
        .reduce((acc, payment) => acc + Number(payment.amountCents ?? 0), 0);

      const depositOutCents = reservation.payments
        .filter((payment) => payment.isDeposit && payment.direction === "OUT")
        .reduce((acc, payment) => acc + Number(payment.amountCents ?? 0), 0);

      let refundableDepositCents = Math.max(0, depositInCents - depositOutCents);
      let depositHeld = reservation.depositHeld === true;

      if (body.settlementMode === "FULL_REFUND") {
        if (depositHeld) {
          throw new Error("La fianza ya está retenida. No se puede devolver desde este cierre.");
        }
        if (refundableDepositCents <= 0) {
          throw new Error("No hay fianza liberable para devolver.");
        }
        if (!body.refundMethod) {
          throw new Error("Falta el método de devolución.");
        }

        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            origin: "STORE",
            method: body.refundMethod,
            amountCents: refundableDepositCents,
            isDeposit: true,
            direction: "OUT",
          },
        });

        refundableDepositCents = 0;
        depositHeld = false;

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            depositHeld: false,
            depositHeldAt: null,
            depositHeldByUserId: null,
            depositHoldReason: null,
          },
        });
      } else if (body.settlementMode === "PARTIAL_REFUND") {
        if (depositHeld) {
          throw new Error("La fianza ya está retenida. No se puede hacer una devolución parcial desde este cierre.");
        }
        if (refundableDepositCents <= 0) {
          throw new Error("No hay fianza liberable para devolver.");
        }
        if (!body.refundMethod) {
          throw new Error("Falta el método de devolución.");
        }

        const refundAmountCents = Number(body.refundAmountCents ?? 0);
        if (!Number.isFinite(refundAmountCents) || refundAmountCents <= 0) {
          throw new Error("Importe de devolución inválido.");
        }
        if (refundAmountCents >= refundableDepositCents) {
          throw new Error("La devolución parcial debe ser menor que la fianza liberable.");
        }
        if (!body.retainReason) {
          throw new Error("Indica el motivo de la retención parcial.");
        }

        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            origin: "STORE",
            method: body.refundMethod,
            amountCents: refundAmountCents,
            isDeposit: true,
            direction: "OUT",
          },
        });

        refundableDepositCents = Math.max(0, refundableDepositCents - refundAmountCents);
        depositHeld = true;

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            depositHeld: true,
            depositHeldAt: new Date(),
            depositHeldByUserId: session.userId,
            depositHoldReason: body.retainReason,
          },
        });
      } else if (body.settlementMode === "RETAIN_ALL") {
        if (refundableDepositCents <= 0 && !depositHeld) {
          throw new Error("No hay fianza pendiente de resolver.");
        }
        if (!body.retainReason) {
          throw new Error("Indica el motivo de la retención.");
        }

        depositHeld = true;

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            depositHeld: true,
            depositHeldAt: new Date(),
            depositHeldByUserId: session.userId,
            depositHoldReason: body.retainReason,
          },
        });
      }

      const depositResolved = depositHeld || refundableDepositCents === 0;
      if (!depositResolved) {
        throw new Error(
          "La fianza aún no está resuelta. Debes devolverla, devolver una parte o dejarla retenida antes de cerrar.",
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
      });

      return {
        ok: true,
        reservationId: reservation.id,
        settlementMode: body.settlementMode,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
