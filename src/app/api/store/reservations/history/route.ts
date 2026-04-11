// src/app/api/store/reservations/history/route.ts
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OperationalOverrideAction, OperationalOverrideTarget } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";
import { getPassVoucherPaidCents, getSignedPaymentCents } from "@/lib/pass-vouchers";

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
      isManualEntry: true,
      manualEntryNote: true,
      financialAdjustmentNote: true,
      financialAdjustedAt: true,
      source: true,
      formalizedAt: true,
      channel: { select: { name: true } },
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true } },
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

  const reservationIds = rowsDb.map((reservation) => reservation.id);
  const attachmentLogs = reservationIds.length
    ? await prisma.operationalOverrideLog.findMany({
        where: {
          targetType: OperationalOverrideTarget.RESERVATION,
          action: OperationalOverrideAction.MANUAL_RESERVATION_CREATE,
          targetId: { in: reservationIds },
          reason: "Adjunto contrato manual",
        },
        orderBy: [{ targetId: "asc" }, { createdAt: "desc" }],
        select: {
          targetId: true,
          payloadJson: true,
          createdAt: true,
        },
      })
    : [];

  const attachmentMap = new Map<
    string,
    {
      fileKey: string | null;
      fileUrl: string | null;
      fileName: string | null;
      uploadedAt: Date | null;
    }
  >();

  for (const log of attachmentLogs) {
    if (attachmentMap.has(log.targetId)) continue;
    const payload =
      log.payloadJson && typeof log.payloadJson === "object"
        ? (log.payloadJson as Record<string, unknown>)
        : null;
    attachmentMap.set(log.targetId, {
      fileKey: typeof payload?.fileKey === "string" ? payload.fileKey : null,
      fileUrl: typeof payload?.fileUrl === "string" ? payload.fileUrl : null,
      fileName: typeof payload?.fileName === "string" ? payload.fileName : null,
      uploadedAt:
        typeof payload?.uploadedAt === "string"
          ? new Date(payload.uploadedAt)
          : log.createdAt,
    });
  }

  const rows = rowsDb.map((reservation) => {
    const attachment = attachmentMap.get(reservation.id);
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
      depositCents: computeReservationDepositCents({
        storedDepositCents: reservation.depositCents,
        quantity: reservation.quantity,
        isLicense: Boolean(reservation.isLicense),
        serviceCategory: reservation.service?.category ?? null,
        items: reservation.items ?? [],
      }),
      depositHeld: reservation.depositHeld,
      depositHoldReason: reservation.depositHoldReason,
      isManualEntry: reservation.isManualEntry,
      manualEntryNote: reservation.manualEntryNote,
      manualContractFileKey: attachment?.fileKey ?? null,
      manualContractFileUrl: attachment?.fileUrl ?? null,
      manualContractFileName: attachment?.fileName ?? null,
      manualContractUploadedAt: attachment?.uploadedAt ?? null,
      financialAdjustmentNote: reservation.financialAdjustmentNote,
      financialAdjustedAt: reservation.financialAdjustedAt,
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
        Number(reservation.totalPriceCents ?? 0) +
        computeReservationDepositCents({
          storedDepositCents: reservation.depositCents,
          quantity: reservation.quantity,
          isLicense: Boolean(reservation.isLicense),
          serviceCategory: reservation.service?.category ?? null,
          items: reservation.items ?? [],
        }),
      incidents: reservation.incidents,
    };
  });

  const passWhere: Record<string, unknown> = {};
  const giftWhere: Record<string, unknown> = {};

  if (q?.trim()) {
    const query = q.trim();
    passWhere.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { buyerName: { contains: query, mode: "insensitive" } },
      { buyerPhone: { contains: query, mode: "insensitive" } },
    ];
    giftWhere.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { buyerName: { contains: query, mode: "insensitive" } },
      { buyerPhone: { contains: query, mode: "insensitive" } },
    ];
  }

  if (dateFrom || dateTo) {
    const soldAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
    passWhere.soldAt = soldAt;
    giftWhere.soldAt = soldAt;
  }

  const [passVouchers, giftVouchers] = await Promise.all([
    prisma.passVoucher.findMany({
      where: passWhere,
      orderBy: [{ soldAt: "desc" }],
      take,
      select: {
        id: true,
        code: true,
        soldAt: true,
        expiresAt: true,
        salePriceCents: true,
        minutesTotal: true,
        minutesRemaining: true,
        buyerName: true,
        buyerPhone: true,
        isVoided: true,
        voidedAt: true,
        voidReason: true,
        soldPayment: { select: { amountCents: true, direction: true } },
        salePayments: { select: { amountCents: true, direction: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.giftVoucher.findMany({
      where: giftWhere,
      orderBy: [{ soldAt: "desc" }],
      take,
      select: {
        id: true,
        code: true,
        soldAt: true,
        expiresAt: true,
        buyerName: true,
        buyerPhone: true,
        isVoided: true,
        voidedAt: true,
        voidReason: true,
        redeemedAt: true,
        product: { select: { name: true, priceCents: true } },
        soldPayment: { select: { amountCents: true, direction: true } },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    rows,
    passVouchers: passVouchers.map((voucher) => ({
      ...voucher,
      paidCents: voucher.isVoided ? 0 : getPassVoucherPaidCents(voucher),
    })),
    giftVouchers: giftVouchers.map((voucher) => ({
      ...voucher,
      paidCents: voucher.isVoided ? 0 : getSignedPaymentCents(voucher.soldPayment),
    })),
  });
}
