// src/app/api/booth/payments/create/route.ts
import { NextResponse } from "next/server";
import { PaymentDirection, PaymentMethod, PaymentOrigin } from "@prisma/client";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  reservationId: z.string().min(1),
  amountCents: z.number().int().positive(), // >0
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CASH"),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  // Solo BOOTH o ADMIN puede cobrar en carpa
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const { reservationId, amountCents, method } = parsed.data;

  // 1) Reserva debe existir y ser BOOTH
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, source: true, totalPriceCents: true },
  });

  if (!res) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });
  if (res.source !== "BOOTH") {
    return NextResponse.json({ error: "Solo se puede cobrar en reservas de carpa" }, { status: 400 });
  }

  // 2) Calcular ya cobrado (solo IN, no depósito)
  const agg = await prisma.payment.aggregate({
    where: {
      reservationId,
      direction: PaymentDirection.IN,
      isDeposit: false,
    },
    _sum: { amountCents: true },
  });

  const paidSoFar = agg._sum.amountCents ?? 0;
  const pending = Math.max(0, res.totalPriceCents - paidSoFar);

  // 3) No permitir cobrar más de lo pendiente (así nunca “se pasa”)
  if (amountCents > pending) {
    return NextResponse.json(
      { error: `Importe supera lo pendiente. Pendiente: ${pending} céntimos` },
      { status: 400 }
    );
  }

  const shiftSessionId =
    typeof session === "object" && session !== null && "shiftSessionId" in session
      ? (session as { shiftSessionId?: string | null }).shiftSessionId ?? null
      : null;

  // 4) Crear pago BOOTH
  const p = await prisma.payment.create({
    data: {
      reservationId,
      origin: PaymentOrigin.BOOTH,
      method: method as PaymentMethod,
      amountCents,
      isDeposit: false,
      direction: PaymentDirection.IN,
      createdByUserId: session.userId,
      shiftSessionId,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, paymentId: p.id, paidNowCents: amountCents });
}
