import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import {
  OperationalOverrideAction,
  OperationalOverrideTarget,
  PaymentDirection,
  PaymentMethod,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";
import { utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz, BUSINESS_TZ } from "@/lib/tz-business";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

const PaymentLineSchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.nativeEnum(PaymentMethod),
  isDeposit: z.boolean().default(false),
  direction: z.nativeEnum(PaymentDirection).default(PaymentDirection.IN),
});

const Body = z.object({
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  status: z.nativeEnum(ReservationStatus).default(ReservationStatus.COMPLETED),
  customerName: z.string().trim().min(1),
  customerCountry: z.string().trim().min(2).max(2).default("ES"),
  customerPhone: z.string().trim().max(50).nullable().optional(),
  customerEmail: z.string().trim().max(200).nullable().optional(),
  channelId: z.string().trim().min(1).nullable().optional(),
  serviceId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(20),
  pax: z.number().int().min(1).max(50),
  isLicense: z.boolean().default(false),
  totalPriceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0).default(0),
  note: z.string().trim().min(3).max(500),
  payments: z.array(PaymentLineSchema).max(12).default([]),
});

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const body = parsed.data;
  const tz = BUSINESS_TZ;
  const activityDate = utcDateFromYmdInTz(tz, body.activityDate);
  const scheduledTime = utcDateTimeFromYmdHmInTz(tz, body.activityDate, body.time ?? null);
  const paymentCreatedAt = scheduledTime ?? activityDate;

  const [service, option] = await Promise.all([
    prisma.service.findUnique({
      where: { id: body.serviceId },
      select: { id: true, category: true, name: true },
    }),
    prisma.serviceOption.findUnique({
      where: { id: body.optionId },
      select: { id: true, serviceId: true, durationMinutes: true },
    }),
  ]);

  if (!service) return new NextResponse("Servicio no existe", { status: 400 });
  if (!option) return new NextResponse("Opción no existe", { status: 400 });
  if (option.serviceId !== service.id) return new NextResponse("La opción no pertenece al servicio", { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          source: ReservationSource.STORE,
          status: body.status,
          activityDate,
          scheduledTime,
          arrivalAt: body.status === ReservationStatus.COMPLETED ? paymentCreatedAt : null,
          formalizedAt: paymentCreatedAt,
          formalizedByUserId: session.userId,
          paymentCompletedAt: paymentCreatedAt,
          readyForPlatformAt:
            body.status === ReservationStatus.READY_FOR_PLATFORM ||
            body.status === ReservationStatus.IN_SEA ||
            body.status === ReservationStatus.COMPLETED
              ? paymentCreatedAt
              : null,
          departureAt: body.status === ReservationStatus.IN_SEA ? paymentCreatedAt : null,
          customerName: body.customerName,
          customerCountry: body.customerCountry.toUpperCase(),
          customerPhone: body.customerPhone?.trim() || null,
          customerEmail: body.customerEmail?.trim() || null,
          serviceId: service.id,
          optionId: option.id,
          channelId: body.channelId ?? null,
          quantity: body.quantity,
          pax: body.pax,
          isLicense: body.isLicense,
          basePriceCents: body.totalPriceCents,
          autoDiscountCents: 0,
          manualDiscountCents: 0,
          totalPriceCents: body.totalPriceCents,
          depositCents: body.depositCents,
          isManualEntry: true,
          manualEntryNote: body.note,
          manualEntryCreatedByUserId: session.userId,
          manualEntryCreatedAt: new Date(),
        },
        select: { id: true },
      });

      await tx.reservationItem.create({
        data: {
          reservationId: reservation.id,
          serviceId: service.id,
          optionId: option.id,
          quantity: body.quantity,
          pax: body.pax,
          unitPriceCents: body.quantity > 0 ? Math.round(body.totalPriceCents / body.quantity) : body.totalPriceCents,
          totalPriceCents: body.totalPriceCents,
          isExtra: false,
        },
      });

      for (const payment of body.payments) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            origin: PaymentOrigin.STORE,
            method: payment.method,
            amountCents: payment.amountCents,
            isDeposit: payment.isDeposit,
            direction: payment.direction,
            createdByUserId: session.userId,
            createdAt: paymentCreatedAt,
          },
        });
      }

      await tx.operationalOverrideLog.create({
        data: {
          targetType: OperationalOverrideTarget.RESERVATION,
          action: OperationalOverrideAction.MANUAL_RESERVATION_CREATE,
          targetId: reservation.id,
          reason: body.note,
          payloadJson: {
            status: body.status,
            totalPriceCents: body.totalPriceCents,
            depositCents: body.depositCents,
            payments: body.payments,
          },
          createdByUserId: session.userId,
        },
      });

      return reservation;
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error: unknown) {
    return new NextResponse(error instanceof Error ? error.message : "No se pudo crear la reserva manual", { status: 400 });
  }
}
