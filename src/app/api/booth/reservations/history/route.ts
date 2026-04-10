import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";

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

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.activityDate = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  const rowsDb = await prisma.reservation.findMany({
    where,
    orderBy: [{ activityDate: "desc" }, { scheduledTime: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      boothCode: true,
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

  const rows = rowsDb.map((reservation) => {
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
    };
  });

  return NextResponse.json({ ok: true, rows });
}
