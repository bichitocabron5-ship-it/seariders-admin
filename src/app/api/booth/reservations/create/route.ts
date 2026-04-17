// src/app/api/booth/reservation/create/route.ts
import { NextResponse } from "next/server";
import {
  PaymentDirection,
  PaymentMethod,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
  RoleName,
  ShiftName,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { commissionFromBase, resolveCommissionRate } from "@/lib/commission";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";

const BodySchema = z.object({
  customerName: z.string().min(1),
  customerCountry: z.string().min(1),
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().min(1).max(4),
  pax: z.number().int().min(1).max(20),
  channelId: z.string().optional().nullable(),
  discountEuros: z.union([z.string(), z.number()]).optional().nullable(),
  boothNote: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
});

function genBoothCode() {
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(100 + Math.random() * 900);
  return `PO-${a}-${b}`;
}

async function findBoothShiftSession(userId: string, shift: ShiftName | undefined) {
  const businessDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ));

  return (
    (await prisma.shiftSession.findFirst({
      where: {
        userId,
        endedAt: null,
        role: { name: "BOOTH" },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    })) ??
    (await prisma.shiftSession.findFirst({
      where: {
        userId,
        businessDate,
        shift: shift ?? "MORNING",
        role: { name: "BOOTH" },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    }))
  );
}

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

  const activityDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ));
  const now = new Date();

  const [service, option, channel, price] = await Promise.all([
    prisma.service.findUnique({
      where: { id: parsed.data.serviceId },
      select: { id: true, name: true, isExternalActivity: true },
    }),
    prisma.serviceOption.findUnique({
      where: { id: parsed.data.optionId },
      select: { id: true, serviceId: true, basePriceCents: true },
    }),
    parsed.data.channelId
      ? prisma.channel.findUnique({
          where: { id: parsed.data.channelId },
          select: {
            id: true,
            name: true,
            kind: true,
            commissionEnabled: true,
            commissionBps: true,
            commissionPct: true,
            commissionRules: {
              where: { isActive: true },
              select: { serviceId: true, commissionPct: true },
            },
          },
        })
      : Promise.resolve(null),
    prisma.servicePrice.findFirst({
      where: {
        serviceId: parsed.data.serviceId,
        optionId: parsed.data.optionId,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { basePriceCents: true },
    }),
  ]);

  if (!service) return NextResponse.json({ error: "Servicio no existe" }, { status: 400 });
  if (!option) return NextResponse.json({ error: "Opción no existe" }, { status: 400 });
  if (option.serviceId !== service.id) {
    return NextResponse.json({ error: "La opción no pertenece al servicio." }, { status: 400 });
  }

  const basePriceCents = Number(price?.basePriceCents ?? option.basePriceCents ?? 0) || 0;
  if (basePriceCents <= 0) {
    return NextResponse.json(
      { error: "Esta opción no tiene precio vigente (Admin > Precios)." },
      { status: 400 }
    );
  }

  const grossTotalCents = basePriceCents * parsed.data.quantity;
  const discountRaw = parsed.data.discountEuros ?? 0;
  const discountNum = typeof discountRaw === "string" ? Number(discountRaw.replace(",", ".")) : discountRaw;
  const discountCents = Math.max(0, Math.round((Number.isFinite(discountNum) ? discountNum : 0) * 100));
  const maxDiscountCents = Math.floor(grossTotalCents * 0.3);

  if (discountCents > maxDiscountCents) {
    return NextResponse.json(
      { error: `Descuento demasiado alto. Máximo: ${(maxDiscountCents / 100).toFixed(2)} €` },
      { status: 400 }
    );
  }

  const totalPriceCents = Math.max(0, grossTotalCents - discountCents);
  const isExternalCharge = channel?.kind === "EXTERNAL_ACTIVITY" || service.isExternalActivity;

  if (isExternalCharge) {
    if (!channel || channel.kind !== "EXTERNAL_ACTIVITY") {
      return NextResponse.json(
        { error: "Las actividades externas deben registrarse con un canal externo." },
        { status: 400 }
      );
    }
    if (!parsed.data.paymentMethod) {
      return NextResponse.json({ error: "Método de pago requerido para actividad externa." }, { status: 400 });
    }

    await assertCashOpenForUser(session.userId, session.role as RoleName);

    const shiftSession = await findBoothShiftSession(session.userId, session.shift);
    if (!shiftSession && String(session.role) !== "ADMIN") {
      return NextResponse.json({ error: "No hay shift session de carpa válida para este cobro." }, { status: 400 });
    }

    const commissionRate = resolveCommissionRate({
      channel,
      serviceId: service.id,
    });
    const commissionCents = commissionFromBase(totalPriceCents, commissionRate);
    const commissionPct = Number((commissionRate * 100).toFixed(2));

    const payment = await prisma.payment.create({
      data: {
        origin: PaymentOrigin.BOOTH,
        method: parsed.data.paymentMethod,
        amountCents: commissionCents,
        isExternalCommissionOnly: true,
        externalGrossAmountCents: totalPriceCents,
        isDeposit: false,
        direction: PaymentDirection.IN,
        createdByUserId: session.userId,
        shiftSessionId: shiftSession?.id ?? null,
        serviceId: service.id,
        channelId: channel.id,
        customerName: parsed.data.customerName.trim(),
        description: `${service.name} · ${channel.name}`,
        notes: parsed.data.boothNote?.trim() || null,
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      mode: "payment",
      paymentId: payment.id,
      amountCents: commissionCents,
      grossAmountCents: totalPriceCents,
      commissionCents,
      commissionPct,
    });
  }

  let boothCode = "";
  for (let i = 0; i < 10; i++) {
    boothCode = genBoothCode();
    const exists = await prisma.reservation.findUnique({ where: { boothCode } }).catch(() => null);
    if (!exists) break;
  }
  if (!boothCode) return NextResponse.json({ error: "No se pudo generar código" }, { status: 500 });

  const reservation = await prisma.reservation.create({
    data: {
      source: ReservationSource.BOOTH,
      status: ReservationStatus.WAITING,
      activityDate,
      scheduledTime: null,
      channelId: parsed.data.channelId ?? null,
      serviceId: parsed.data.serviceId,
      optionId: parsed.data.optionId,
      quantity: parsed.data.quantity,
      pax: parsed.data.pax,
      basePriceCents,
      manualDiscountCents: discountCents,
      totalPriceCents,
      customerName: parsed.data.customerName,
      customerCountry: parsed.data.customerCountry,
      customerAddress: "-",
      customerDocType: "-",
      customerDocNumber: "-",
      boothCode,
      boothCreatedAt: new Date(),
      boothCreatedByUserId: session.userId,
      boothNote: parsed.data.boothNote?.trim() || null,
    },
    select: { id: true, boothCode: true },
  });

  return NextResponse.json({ ok: true, mode: "reservation", reservationId: reservation.id, boothCode: reservation.boothCode });
}
