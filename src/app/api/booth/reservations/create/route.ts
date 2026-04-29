import { NextResponse } from "next/server";
import {
  PaymentDirection,
  PaymentMethod,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
  RoleName,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import {
  commissionFromBase,
  getAppliedCommissionPctTx,
  resolveCommissionRate,
  resolveDiscountPolicy,
} from "@/lib/commission";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";

const BodySchema = z.object({
  customerName: z.string().min(1),
  customerCountry: z.string().min(1),
  serviceId: z.string().min(1).optional(),
  optionId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  pax: z.number().int().min(1).max(20).optional(),
  channelId: z.string().optional().nullable(),
  discountEuros: z.union([z.string(), z.number()]).optional().nullable(),
  discountResponsibility: z.enum(["COMPANY", "PROMOTER", "SHARED"]).optional().nullable(),
  promoterDiscountSharePct: z.union([z.string(), z.number()]).optional().nullable(),
  boothNote: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        optionId: z.string().nullable().optional(),
        quantity: z.number().int().min(1).max(99),
        pax: z.number().int().min(1).max(20),
        isExtra: z.boolean().default(false),
      })
    )
    .min(1)
    .optional(),
});

function genBoothCode() {
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(100 + Math.random() * 900);
  return `PO-${a}-${b}`;
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

  const itemsInput =
    parsed.data.items && parsed.data.items.length > 0
      ? parsed.data.items
      : parsed.data.serviceId && parsed.data.optionId
        ? [
            {
              serviceId: parsed.data.serviceId,
              optionId: parsed.data.optionId,
              quantity: parsed.data.quantity ?? 1,
              pax: parsed.data.pax ?? 1,
              isExtra: false,
            },
          ]
        : [];

  if (itemsInput.length === 0) {
    return NextResponse.json({ error: "Debes añadir al menos una actividad." }, { status: 400 });
  }

  const mainItem = itemsInput.find((item) => !item.isExtra) ?? null;
  if (!mainItem) {
    return NextResponse.json({ error: "La reserva debe incluir una actividad principal." }, { status: 400 });
  }

  const serviceIds = Array.from(new Set(itemsInput.map((item) => item.serviceId)));
  const optionIds = Array.from(
    new Set(itemsInput.map((item) => item.optionId).filter((value): value is string => Boolean(value)))
  );

  const [services, options, channel] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, category: true, isExternalActivity: true },
    }),
    optionIds.length > 0
      ? prisma.serviceOption.findMany({
          where: { id: { in: optionIds } },
          select: { id: true, serviceId: true, basePriceCents: true },
        })
      : Promise.resolve([]),
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
            discountResponsibility: true,
            promoterDiscountShareBps: true,
            commissionRules: {
              where: { isActive: true },
              select: { serviceId: true, commissionPct: true },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const optionsById = new Map(options.map((option) => [option.id, option]));

  const pricedItems: Array<{
    serviceId: string;
    serviceName: string;
    serviceCategory: string | null;
    optionId: string | null;
    quantity: number;
    pax: number;
    isExtra: boolean;
    unitPriceCents: number;
    totalPriceCents: number;
    servicePriceId: string | null;
  }> = [];

  let serviceSubtotalCents = 0;
  let grossTotalCents = 0;

  for (const item of itemsInput) {
    const service = servicesById.get(item.serviceId);
    if (!service) {
      return NextResponse.json({ error: "Servicio no existe" }, { status: 400 });
    }

    const isExtra = item.isExtra || String(service.category ?? "").toUpperCase() === "EXTRA";
    if (isExtra && item.optionId) {
      return NextResponse.json({ error: "Los extras no llevan duración." }, { status: 400 });
    }

    let optionId: string | null = null;
    let unitPriceCents = 0;
    let servicePriceId: string | null = null;

    if (isExtra) {
      const extraPrice = await prisma.servicePrice.findFirst({
        where: {
          serviceId: service.id,
          durationMin: null,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: "desc" },
        select: { id: true, basePriceCents: true },
      });

      unitPriceCents = Number(extraPrice?.basePriceCents ?? 0) || 0;
      servicePriceId = extraPrice?.id ?? null;
      if (unitPriceCents <= 0) {
        return NextResponse.json(
          { error: `Este extra no tiene precio vigente: ${service.name}` },
          { status: 400 }
        );
      }
    } else {
      if (!item.optionId) {
        return NextResponse.json({ error: "Falta duración para una actividad." }, { status: 400 });
      }

      const option = optionsById.get(item.optionId);
      if (!option) return NextResponse.json({ error: "Opción no existe" }, { status: 400 });
      if (option.serviceId !== service.id) {
        return NextResponse.json({ error: "La opción no pertenece al servicio." }, { status: 400 });
      }

      const price = await prisma.servicePrice.findFirst({
        where: {
          serviceId: service.id,
          optionId: option.id,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: "desc" },
        select: { id: true, basePriceCents: true },
      });

      unitPriceCents = Number(price?.basePriceCents ?? option.basePriceCents ?? 0) || 0;
      servicePriceId = price?.id ?? null;
      if (unitPriceCents <= 0) {
        return NextResponse.json(
          { error: "Esta opción no tiene precio vigente (Admin > Precios)." },
          { status: 400 }
        );
      }

      optionId = option.id;
    }

    const totalPriceCents = unitPriceCents * item.quantity;
    if (!isExtra) serviceSubtotalCents += totalPriceCents;
    grossTotalCents += totalPriceCents;

    pricedItems.push({
      serviceId: service.id,
      serviceName: service.name,
      serviceCategory: service.category ?? null,
      optionId,
      quantity: item.quantity,
      pax: item.pax,
      isExtra,
      unitPriceCents,
      totalPriceCents,
      servicePriceId,
    });
  }

  const discountRaw = parsed.data.discountEuros ?? 0;
  const discountNum = typeof discountRaw === "string" ? Number(discountRaw.replace(",", ".")) : discountRaw;
  const discountCents = Math.max(0, Math.round((Number.isFinite(discountNum) ? discountNum : 0) * 100));
  const promoterDiscountShareRaw = parsed.data.promoterDiscountSharePct ?? 0;
  const promoterDiscountSharePct =
    typeof promoterDiscountShareRaw === "string"
      ? Number(promoterDiscountShareRaw.replace(",", "."))
      : promoterDiscountShareRaw;
  const maxDiscountCents = Math.floor(grossTotalCents * 0.3);

  if (discountCents > maxDiscountCents) {
    return NextResponse.json(
      { error: `Descuento demasiado alto. Máximo: ${(maxDiscountCents / 100).toFixed(2)} €` },
      { status: 400 }
    );
  }

  const discountPolicy = resolveDiscountPolicy({
    responsibility: parsed.data.discountResponsibility ?? undefined,
    promoterDiscountShareBps:
      Math.round((Number.isFinite(promoterDiscountSharePct) ? promoterDiscountSharePct : 0) * 100) || undefined,
    channel,
  });

  const commercial = await computeReservationCommercialBreakdown({
    when: now,
    discountLines: pricedItems.map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId,
      category: item.serviceCategory ?? null,
      quantity: item.quantity,
      lineBaseCents: item.totalPriceCents,
      promoCode: null,
    })),
    customerCountry: parsed.data.customerCountry,
    promotionsEnabled: false,
    totalBeforeDiscountsCents: grossTotalCents,
    manualDiscountCents: discountCents,
    discountResponsibility: discountPolicy.discountResponsibility,
    promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
  });

  const mainService = servicesById.get(mainItem.serviceId)!;
  const isExternalCharge = channel?.kind === "EXTERNAL_ACTIVITY" || mainService.isExternalActivity;

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
    if (pricedItems.length !== 1 || pricedItems[0]?.isExtra) {
      return NextResponse.json(
        { error: "Los cobros externos en Booth solo permiten una actividad principal." },
        { status: 400 }
      );
    }

    await assertCashOpenForUser(session.userId, session.role as RoleName, session.shiftSessionId);

    const shiftSession = await findCurrentShiftSession({
      userId: session.userId,
      role: RoleName.BOOTH,
      shiftSessionId: session.shiftSessionId,
    });

    const commissionRate = resolveCommissionRate({
      channel,
      serviceId: mainService.id,
    });
    const commissionCents = commissionFromBase(commercial.commissionBaseCents, commissionRate);
    const commissionPct = Number((commissionRate * 100).toFixed(2));

    const payment = await prisma.payment.create({
      data: {
        origin: PaymentOrigin.BOOTH,
        method: parsed.data.paymentMethod,
        amountCents: commissionCents,
        commissionBaseCents: commercial.commissionBaseCents,
        appliedCommissionPct: commissionPct,
        externalDiscountCents: commercial.totalDiscountCents,
        discountResponsibility: commercial.discountResponsibility,
        promoterDiscountShareBps: commercial.promoterDiscountShareBps,
        promoterDiscountCents: commercial.promoterDiscountCents,
        companyDiscountCents: commercial.companyDiscountCents,
        isExternalCommissionOnly: true,
        externalGrossAmountCents: grossTotalCents,
        isDeposit: false,
        direction: PaymentDirection.IN,
        createdByUserId: session.userId,
        shiftSessionId: shiftSession?.id ?? null,
        serviceId: mainService.id,
        channelId: channel.id,
        customerName: parsed.data.customerName.trim(),
        description: `${mainService.name} · ${channel.name}`,
        notes: parsed.data.boothNote?.trim() || null,
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      mode: "payment",
      paymentId: payment.id,
      amountCents: commissionCents,
      grossAmountCents: grossTotalCents,
      commissionBaseCents: commercial.commissionBaseCents,
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
      serviceId: mainItem.serviceId,
      optionId: mainItem.optionId!,
      quantity: mainItem.quantity,
      pax: mainItem.pax,
      basePriceCents: serviceSubtotalCents,
      commissionBaseCents: commercial.commissionBaseCents,
      appliedCommissionPct: await getAppliedCommissionPctTx(prisma, {
        channelId: parsed.data.channelId ?? null,
        serviceId: mainItem.serviceId,
      }),
      autoDiscountCents: commercial.autoDiscountCents,
      manualDiscountCents: commercial.manualDiscountCents,
      discountResponsibility: commercial.discountResponsibility,
      promoterDiscountShareBps: commercial.promoterDiscountShareBps,
      promoterDiscountCents: commercial.promoterDiscountCents,
      companyDiscountCents: commercial.companyDiscountCents,
      totalPriceCents: commercial.finalTotalCents,
      customerName: parsed.data.customerName,
      customerCountry: parsed.data.customerCountry,
      customerAddress: "-",
      customerDocType: "-",
      customerDocNumber: "-",
      boothCode,
      boothCreatedAt: new Date(),
      boothCreatedByUserId: session.userId,
      boothNote: parsed.data.boothNote?.trim() || null,
      items: {
        create: pricedItems.map((item) => ({
          serviceId: item.serviceId,
          optionId: item.optionId,
          servicePriceId: item.servicePriceId,
          quantity: item.quantity,
          pax: item.pax,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          isExtra: item.isExtra,
        })),
      },
    },
    select: { id: true, boothCode: true },
  });

  return NextResponse.json({ ok: true, mode: "reservation", reservationId: reservation.id, boothCode: reservation.boothCode });
}
