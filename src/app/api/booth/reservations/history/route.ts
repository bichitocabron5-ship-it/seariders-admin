import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";
import { BUSINESS_TZ, tzLocalToUtcDate, utcDateFromYmdInTz } from "@/lib/tz-business";

export const runtime = "nodejs";

const Query = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { q, status, dateFrom, dateTo, take } = parsed.data;
  const where: Record<string, unknown> = { source: "BOOTH" };

  if (q?.trim()) {
    where.customerName = {
      contains: q.trim(),
      mode: "insensitive",
    };
  }

  const isExternalStatus = status === "EXTERNAL_PAYMENT" || status === "EXTERNAL_CANCELED";

  if (status && status !== "ALL" && !isExternalStatus) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    const endExclusive = dateTo
      ? (() => {
          const [y, m, d] = dateTo.split("-").map(Number);
          return tzLocalToUtcDate(BUSINESS_TZ, y, m, d + 1, 0, 0);
        })()
      : undefined;

    where.activityDate = {
      ...(dateFrom ? { gte: utcDateFromYmdInTz(BUSINESS_TZ, dateFrom) } : {}),
      ...(endExclusive ? { lt: endExclusive } : {}),
    };
  }

  const reservationRowsDb =
    isExternalStatus
      ? []
      : await prisma.reservation.findMany({
          where,
          orderBy: [{ activityDate: "desc" }, { scheduledTime: "desc" }, { createdAt: "desc" }],
          take,
          select: {
            id: true,
            boothCode: true,
            boothNote: true,
            status: true,
            activityDate: true,
            scheduledTime: true,
            arrivedStoreAt: true,
            createdAt: true,
            customerName: true,
            customerCountry: true,
            quantity: true,
            pax: true,
            totalPriceCents: true,
            commissionBaseCents: true,
            channel: { select: { name: true } },
            service: { select: { name: true, category: true } },
            option: { select: { durationMinutes: true } },
            payments: {
              select: {
                amountCents: true,
                isDeposit: true,
                direction: true,
                method: true,
                createdAt: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });

  const paymentWhere: Record<string, unknown> = {
    reservationId: null,
    reversalOfPaymentId: null,
    origin: "BOOTH",
    channelId: { not: null },
    serviceId: { not: null },
  };

  if (q?.trim()) {
    paymentWhere.customerName = {
      contains: q.trim(),
      mode: "insensitive",
    };
  }

  if (dateFrom || dateTo) {
    const endExclusive = dateTo
      ? (() => {
          const [y, m, d] = dateTo.split("-").map(Number);
          return tzLocalToUtcDate(BUSINESS_TZ, y, m, d + 1, 0, 0);
        })()
      : undefined;

    paymentWhere.createdAt = {
      ...(dateFrom ? { gte: utcDateFromYmdInTz(BUSINESS_TZ, dateFrom) } : {}),
      ...(endExclusive ? { lt: endExclusive } : {}),
    };
  }

  const externalPaymentsDb =
    !status || status === "ALL" || isExternalStatus
      ? await prisma.payment.findMany({
          where: paymentWhere,
          orderBy: [{ createdAt: "desc" }],
          take,
          select: {
            id: true,
            createdAt: true,
            customerName: true,
            amountCents: true,
            commissionBaseCents: true,
            direction: true,
            method: true,
            description: true,
            isExternalCommissionOnly: true,
            externalGrossAmountCents: true,
            reversals: {
              select: {
                id: true,
                createdAt: true,
                amountCents: true,
                direction: true,
              },
              orderBy: { createdAt: "asc" },
            },
            service: { select: { name: true, category: true } },
            channel: { select: { name: true } },
          },
        })
      : [];

  const reservationRows = reservationRowsDb.map((reservation) => {
    const servicePaidCents = reservation.payments
      .filter((payment) => !payment.isDeposit)
      .reduce((sum, payment) => {
        const sign = payment.direction === "OUT" ? -1 : 1;
        return sum + sign * Number(payment.amountCents ?? 0);
      }, 0);

    const depositPaidCents = reservation.payments
      .filter((payment) => payment.isDeposit)
      .reduce((sum, payment) => {
        const sign = payment.direction === "OUT" ? -1 : 1;
        return sum + sign * Number(payment.amountCents ?? 0);
      }, 0);

    return {
      id: reservation.id,
      boothCode: reservation.boothCode,
      boothNote: reservation.boothNote,
      status: reservation.status,
      activityDate: reservation.activityDate,
      scheduledTime: reservation.scheduledTime,
      arrivedStoreAt: reservation.arrivedStoreAt,
      createdAt: reservation.createdAt,
      customerName: reservation.customerName,
      customerCountry: reservation.customerCountry,
      quantity: reservation.quantity,
      pax: reservation.pax,
      totalPriceCents: Number(reservation.totalPriceCents ?? 0),
      serviceName: reservation.service?.name ?? null,
      serviceCategory: reservation.service?.category ?? null,
      durationMinutes: reservation.option?.durationMinutes ?? null,
      servicePaidCents,
      servicePendingCents: Math.max(0, Number(reservation.totalPriceCents ?? 0) - servicePaidCents),
      depositPaidCents,
      paymentsCount: reservation.payments.length,
      lastPaymentAt: reservation.payments[reservation.payments.length - 1]?.createdAt ?? null,
      rowKind: "RESERVATION" as const,
      channelName: reservation.channel?.name ?? null,
      paymentMethod: null,
      grossExternalAmountCents: null,
      effectiveCommissionPct:
        Number(reservation.totalPriceCents ?? 0) > 0 && Number(reservation.commissionBaseCents ?? 0) > 0
          ? Number(((Number(reservation.commissionBaseCents ?? 0) / Number(reservation.totalPriceCents ?? 0)) * 100).toFixed(2))
          : null,
      canCancel: false,
    };
  });

  const externalPaymentRows = externalPaymentsDb.map((payment) => {
    const originalAmount =
      payment.direction === "OUT" ? -Math.abs(Number(payment.amountCents ?? 0)) : Math.abs(Number(payment.amountCents ?? 0));
    const reversalNet = payment.reversals.reduce(
      (sum, reversal) => sum + (reversal.direction === "OUT" ? -Math.abs(Number(reversal.amountCents ?? 0)) : Math.abs(Number(reversal.amountCents ?? 0))),
      0
    );
    const signedAmount = originalAmount + reversalNet;
    const grossExternalAmountCents = Number(payment.externalGrossAmountCents ?? 0) || null;
    const lastPaymentAt = payment.reversals[payment.reversals.length - 1]?.createdAt ?? payment.createdAt;

    return {
      id: payment.id,
      boothCode: null,
      boothNote: null,
      status: signedAmount <= 0 ? "EXTERNAL_CANCELED" : "EXTERNAL_PAYMENT",
      activityDate: payment.createdAt,
      scheduledTime: null,
      arrivedStoreAt: null,
      createdAt: payment.createdAt,
      customerName: payment.customerName ?? null,
      customerCountry: null,
      quantity: null,
      pax: null,
      totalPriceCents: grossExternalAmountCents ?? Math.abs(signedAmount),
      serviceName: payment.service?.name ?? payment.description ?? "Venta externa",
      serviceCategory: payment.service?.category ?? "Canal externo",
      durationMinutes: null,
      servicePaidCents: signedAmount,
      servicePendingCents: 0,
      depositPaidCents: 0,
      paymentsCount: 1 + payment.reversals.length,
      lastPaymentAt,
      rowKind: "EXTERNAL_PAYMENT" as const,
      channelName: payment.channel?.name ?? null,
      paymentMethod: payment.method,
      grossExternalAmountCents,
      effectiveCommissionPct:
        Number(payment.externalGrossAmountCents ?? 0) > 0 && Number(payment.commissionBaseCents ?? 0) > 0
          ? Number(((Number(payment.commissionBaseCents ?? 0) / Number(payment.externalGrossAmountCents ?? 0)) * 100).toFixed(2))
          : null,
      canCancel: signedAmount > 0,
    };
  });

  const filteredExternalPaymentRows =
    status === "EXTERNAL_PAYMENT"
      ? externalPaymentRows.filter((row) => row.status === "EXTERNAL_PAYMENT")
      : status === "EXTERNAL_CANCELED"
      ? externalPaymentRows.filter((row) => row.status === "EXTERNAL_CANCELED")
      : externalPaymentRows;

  const rows = [...reservationRows, ...filteredExternalPaymentRows]
    .sort((a, b) => new Date(b.scheduledTime ?? b.activityDate ?? b.createdAt).getTime() - new Date(a.scheduledTime ?? a.activityDate ?? a.createdAt).getTime())
    .slice(0, take);

  return NextResponse.json({ ok: true, rows });
}
