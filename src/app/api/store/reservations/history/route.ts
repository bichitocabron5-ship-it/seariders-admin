// src/app/api/store/reservations/history/route.ts
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
  hasIncident: z.enum(["true", "false"]).optional(),
  depositHeld: z.enum(["true", "false"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    hasIncident: url.searchParams.get("hasIncident") ?? undefined,
    depositHeld: url.searchParams.get("depositHeld") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { q, status, hasIncident, depositHeld, dateFrom, dateTo, take } = parsed.data;
  const where: Record<string, unknown> = {};

  if (q?.trim()) {
    where.customerName = {
      contains: q.trim(),
      mode: "insensitive",
    };
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (depositHeld) {
    where.depositHeld = depositHeld === "true";
  }

  if (dateFrom || dateTo) {
    where.activityDate = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (hasIncident === "true") {
    where.incidents = { some: {} };
  }

  if (hasIncident === "false") {
    where.incidents = { none: {} };
  }

  const rowsDb = await prisma.reservation.findMany({
    where,
    orderBy: [{ activityDate: "desc" }, { scheduledTime: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      status: true,
      activityDate: true,
      scheduledTime: true,
      arrivalAt: true,
      customerName: true,
      customerCountry: true,
      quantity: true,
      pax: true,
      isLicense: true,
      totalPriceCents: true,
      depositCents: true,
      depositHeld: true,
      depositHoldReason: true,
      source: true,
      formalizedAt: true,
      channel: { select: { name: true } },
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      payments: {
        select: {
          amountCents: true,
          isDeposit: true,
          direction: true,
        },
      },
      incidents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          level: true,
          status: true,
          isOpen: true,
          retainDeposit: true,
          retainDepositCents: true,
          description: true,
          notes: true,
          maintenanceEventId: true,
          createdAt: true,
          entityType: true,
          jetskiId: true,
          assetId: true,
        },
      },
    },
  });

  const rows = rowsDb.map((reservation) => {
    const paidCents = reservation.payments.reduce((sum, payment) => {
      const sign = payment.direction === "OUT" ? -1 : 1;
      return sum + sign * payment.amountCents;
    }, 0);

    const depositCollectedCents = reservation.payments
      .filter((payment) => payment.isDeposit && payment.direction === "IN")
      .reduce((sum, payment) => sum + payment.amountCents, 0);

    const depositReturnedCents = reservation.payments
      .filter((payment) => payment.isDeposit && payment.direction === "OUT")
      .reduce((sum, payment) => sum + payment.amountCents, 0);

    const paidDepositCents = reservation.payments
      .filter((payment) => payment.isDeposit)
      .reduce((sum, payment) => {
        const sign = payment.direction === "OUT" ? -1 : 1;
        return sum + sign * payment.amountCents;
      }, 0);

    return {
      id: reservation.id,
      status: reservation.status,
      activityDate: reservation.activityDate,
      scheduledTime: reservation.scheduledTime,
      arrivalAt: reservation.arrivalAt,
      customerName: reservation.customerName,
      customerCountry: reservation.customerCountry,
      quantity: reservation.quantity,
      pax: reservation.pax,
      isLicense: reservation.isLicense,
      totalPriceCents: reservation.totalPriceCents,
      depositCents: reservation.depositCents,
      depositHeld: reservation.depositHeld,
      depositHoldReason: reservation.depositHoldReason,
      source: reservation.source,
      formalizedAt: reservation.formalizedAt,
      channelName: reservation.channel?.name ?? null,
      serviceName: reservation.service?.name ?? null,
      serviceCategory: reservation.service?.category ?? null,
      durationMinutes: reservation.option?.durationMinutes ?? null,
      paidCents,
      paidDepositCents,
      depositCollectedCents,
      depositReturnedCents,
      depositRetainedCents: reservation.depositHeld ? Math.max(0, paidDepositCents) : 0,
      totalToChargeCents:
        Number(reservation.totalPriceCents ?? 0) + Number(reservation.depositCents ?? 0),
      incidents: reservation.incidents,
    };
  });

  return NextResponse.json({ ok: true, rows });
}
