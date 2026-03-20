// src/app/api/reservations/history/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { z } from "zod";

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
    where.incidents = {
      some: {},
    };
  }

  if (hasIncident === "false") {
    where.incidents = {
      none: {},
    };
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

      channel: {
        select: {
          name: true,
        },
      },

      service: {
        select: {
          name: true,
          category: true,
        },
      },

      option: {
        select: {
          durationMinutes: true,
        },
      },

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

  const rows = rowsDb.map((r) => {
    const paidCents = r.payments.reduce((sum, p) => {
      const sign = p.direction === "OUT" ? -1 : 1;
      return sum + sign * p.amountCents;
    }, 0);

    const paidDepositCents = r.payments
      .filter((p) => p.isDeposit)
      .reduce((sum, p) => {
        const sign = p.direction === "OUT" ? -1 : 1;
        return sum + sign * p.amountCents;
      }, 0);

    const totalToChargeCents =
      Number(r.totalPriceCents ?? 0) + Number(r.depositCents ?? 0);

    return {
      id: r.id,
      status: r.status,
      activityDate: r.activityDate,
      scheduledTime: r.scheduledTime,
      arrivalAt: r.arrivalAt,
      customerName: r.customerName,
      customerCountry: r.customerCountry,
      quantity: r.quantity,
      pax: r.pax,
      isLicense: r.isLicense,
      totalPriceCents: r.totalPriceCents,
      depositCents: r.depositCents,
      depositHeld: r.depositHeld,
      depositHoldReason: r.depositHoldReason,
      source: r.source,
      formalizedAt: r.formalizedAt,
      channelName: r.channel?.name ?? null,
      serviceName: r.service?.name ?? null,
      serviceCategory: r.service?.category ?? null,
      durationMinutes: r.option?.durationMinutes ?? null,
      paidCents,
      paidDepositCents,
      totalToChargeCents,
      incidents: r.incidents,
    };
  });

  return NextResponse.json({
    ok: true,
    rows,
  });
}