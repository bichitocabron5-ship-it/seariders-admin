import { NextResponse } from "next/server";
import {
  ChannelCommissionLineStatus,
  PaymentOrigin,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({
  status: z.nativeEnum(ChannelCommissionLineStatus).optional(),
  channelId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  origin: z.nativeEnum(PaymentOrigin).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  take: z.string().optional(),
});

function startOfYmd(ymd: string) {
  return utcDateFromYmdInTz(BUSINESS_TZ, ymd);
}

function endExclusiveOfYmd(ymd: string) {
  const end = utcDateFromYmdInTz(BUSINESS_TZ, ymd);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function applyDateRange(
  where: Prisma.ChannelCommissionLineWhereInput,
  field: "generatedAt" | "dueDate",
  from?: string,
  to?: string
) {
  if (!from && !to) return;
  where[field] = {
    ...(from ? { gte: startOfYmd(from) } : {}),
    ...(to ? { lt: endExclusiveOfYmd(to) } : {}),
  };
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Q.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    channelId: url.searchParams.get("channelId") ?? undefined,
    serviceId: url.searchParams.get("serviceId") ?? undefined,
    origin: url.searchParams.get("origin") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    dueFrom: url.searchParams.get("dueFrom") ?? undefined,
    dueTo: url.searchParams.get("dueTo") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
  }

  const take = Math.min(500, Math.max(20, Number(parsed.data.take ?? 200)));
  const baseWhere: Prisma.ChannelCommissionLineWhereInput = {};
  if (parsed.data.channelId) baseWhere.channelId = parsed.data.channelId;
  if (parsed.data.serviceId) baseWhere.serviceId = parsed.data.serviceId;
  if (parsed.data.origin) baseWhere.sourceOrigin = parsed.data.origin;
  applyDateRange(baseWhere, "generatedAt", parsed.data.dateFrom, parsed.data.dateTo);
  applyDateRange(baseWhere, "dueDate", parsed.data.dueFrom, parsed.data.dueTo);

  const where: Prisma.ChannelCommissionLineWhereInput = {
    ...baseWhere,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
  };

  const [rows, statusGroups, channels, services] = await Promise.all([
    prisma.channelCommissionLine.findMany({
      where,
      take,
      orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        channelId: true,
        reservationId: true,
        paymentId: true,
        sourceOrigin: true,
        serviceId: true,
        customerName: true,
        commissionBaseCents: true,
        appliedCommissionMode: true,
        appliedCommissionValue: true,
        appliedCommissionPct: true,
        commissionCents: true,
        generatedAt: true,
        dueDate: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        notes: true,
        channel: { select: { id: true, name: true, kind: true } },
        service: { select: { id: true, name: true, category: true } },
        reservation: {
          select: {
            id: true,
            source: true,
            status: true,
            boothCode: true,
            activityDate: true,
            scheduledTime: true,
            customerName: true,
          },
        },
        payment: {
          select: {
            id: true,
            method: true,
            createdAt: true,
            amountCents: true,
            direction: true,
            isExternalCommissionOnly: true,
          },
        },
        paidByUser: { select: { id: true, fullName: true, username: true } },
      },
    }),
    prisma.channelCommissionLine.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
      _sum: { commissionCents: true },
    }),
    prisma.channel.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, isActive: true },
    }),
    prisma.service.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, isActive: true },
    }),
  ]);

  const summary = {
    PENDING: { count: 0, commissionCents: 0 },
    PAID: { count: 0, commissionCents: 0 },
    VOIDED: { count: 0, commissionCents: 0 },
  };

  for (const group of statusGroups) {
    summary[group.status] = {
      count: Number(group._count._all ?? 0),
      commissionCents: Number(group._sum.commissionCents ?? 0),
    };
  }

  return NextResponse.json({
    ok: true,
    rows,
    summary,
    filters: { channels, services },
  });
}
