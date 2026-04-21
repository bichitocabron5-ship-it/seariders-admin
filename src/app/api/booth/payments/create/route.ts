// src/app/api/booth/payments/create/route.ts
import { NextResponse } from "next/server";
import { PaymentDirection, PaymentMethod, PaymentOrigin, RoleName } from "@prisma/client";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { findCurrentShiftSession } from "@/lib/shiftSessions";

const BodySchema = z.object({
  reservationId: z.string().min(1),
  amountCents: z.number().int().positive(),
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CASH"),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  await assertCashOpenForUser(session.userId, session.role as RoleName, session.shiftSessionId);

  const { reservationId, amountCents, method } = parsed.data;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, source: true, totalPriceCents: true },
  });

  if (!reservation) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });
  if (reservation.source !== "BOOTH") {
    return NextResponse.json({ error: "Solo se puede cobrar en reservas de carpa" }, { status: 400 });
  }

  const agg = await prisma.payment.aggregate({
    where: {
      reservationId,
      direction: PaymentDirection.IN,
      isDeposit: false,
    },
    _sum: { amountCents: true },
  });

  const paidSoFar = agg._sum.amountCents ?? 0;
  const pending = Math.max(0, reservation.totalPriceCents - paidSoFar);

  if (amountCents > pending) {
    return NextResponse.json(
      { error: `Importe supera lo pendiente. Pendiente: ${pending} céntimos` },
      { status: 400 }
    );
  }

  const shiftSession = await findCurrentShiftSession({
    userId: session.userId,
    role: RoleName.BOOTH,
    shiftSessionId: session.shiftSessionId,
  });

  if (!shiftSession && String(session.role) !== "ADMIN") {
    return NextResponse.json({ error: "No hay shift session de carpa válida para este cobro." }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      reservationId,
      origin: PaymentOrigin.BOOTH,
      method: method as PaymentMethod,
      amountCents,
      isDeposit: false,
      direction: PaymentDirection.IN,
      createdByUserId: session.userId,
      shiftSessionId: shiftSession?.id ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, paymentId: payment.id, paidNowCents: amountCents });
}
