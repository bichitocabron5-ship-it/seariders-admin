import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { OperationalOverrideAction, OperationalOverrideTarget, ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

const Body = z.object({
  totalPriceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0),
  note: z.string().trim().min(3).max(500),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const body = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          totalPriceCents: true,
          depositCents: true,
          basePriceCents: true,
          autoDiscountCents: true,
          manualDiscountCents: true,
        },
      });

      if (!reservation) throw new Error("Reserva no existe");
      if (reservation.status === ReservationStatus.CANCELED) throw new Error("No se pueden ajustar importes de una reserva cancelada");

      await tx.reservation.update({
        where: { id },
        data: {
          basePriceCents: body.totalPriceCents,
          autoDiscountCents: 0,
          manualDiscountCents: 0,
          manualDiscountReason: null,
          promoCode: null,
          totalPriceCents: body.totalPriceCents,
          depositCents: body.depositCents,
          financialAdjustmentNote: body.note,
          financialAdjustedByUserId: session.userId,
          financialAdjustedAt: new Date(),
        },
      });

      const mainItem = await tx.reservationItem.findFirst({
        where: { reservationId: id, isExtra: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, quantity: true },
      });

      if (mainItem) {
        const qty = Math.max(1, Number(mainItem.quantity ?? 1));
        await tx.reservationItem.update({
          where: { id: mainItem.id },
          data: {
            unitPriceCents: Math.round(body.totalPriceCents / qty),
            totalPriceCents: body.totalPriceCents,
          },
        });
      }

      await tx.operationalOverrideLog.create({
        data: {
          targetType: OperationalOverrideTarget.RESERVATION,
          action: OperationalOverrideAction.RESERVATION_FINANCIAL_ADJUSTMENT,
          targetId: id,
          reason: body.note,
          payloadJson: {
            before: {
              totalPriceCents: reservation.totalPriceCents,
              depositCents: reservation.depositCents,
              basePriceCents: reservation.basePriceCents,
              autoDiscountCents: reservation.autoDiscountCents,
              manualDiscountCents: reservation.manualDiscountCents,
            },
            after: {
              totalPriceCents: body.totalPriceCents,
              depositCents: body.depositCents,
            },
          },
          createdByUserId: session.userId,
        },
      });

      return { id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    return new NextResponse(error instanceof Error ? error.message : "No se pudo ajustar la reserva", { status: 400 });
  }
}
