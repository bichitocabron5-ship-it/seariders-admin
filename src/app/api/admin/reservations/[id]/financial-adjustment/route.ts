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
  ReservationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

const Body = z.object({
  totalPriceCents: z.number().int().min(0),
  depositCents: z.number().int().min(0),
  note: z.string().trim().min(3).max(500),
});

type PaymentLine = {
  id: string;
  amountCents: number;
  isDeposit: boolean;
  direction: PaymentDirection;
  method: PaymentMethod;
  origin: PaymentOrigin;
  shiftSessionId: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function allocateAmounts(lines: PaymentLine[], targetGrossCents: number) {
  const target = Math.max(0, Math.trunc(targetGrossCents));
  if (lines.length === 0) return [] as Array<{ id: string; amountCents: number }>;
  if (target === 0) return lines.map((line) => ({ id: line.id, amountCents: 0 }));

  const currentGross = lines.reduce((sum, line) => sum + Math.max(0, Number(line.amountCents ?? 0)), 0);
  if (currentGross <= 0) {
    return lines.map((line, index) => ({
      id: line.id,
      amountCents: index === 0 ? target : 0,
    }));
  }

  const scaled = lines.map((line) => {
    const raw = (Math.max(0, Number(line.amountCents ?? 0)) * target) / currentGross;
    const base = Math.floor(raw);
    return {
      id: line.id,
      amountCents: base,
      remainder: raw - base,
    };
  });

  let remainder = target - scaled.reduce((sum, line) => sum + line.amountCents, 0);
  scaled
    .slice()
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((line) => {
      if (remainder <= 0) return;
      const match = scaled.find((entry) => entry.id === line.id);
      if (!match) return;
      match.amountCents += 1;
      remainder -= 1;
    });

  return scaled.map(({ id, amountCents }) => ({ id, amountCents }));
}

async function rebalancePaymentLinesTx(args: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  lines: PaymentLine[];
  targetGrossCents: number;
  reservationId: string;
  isDeposit: boolean;
  direction: PaymentDirection;
  fallback: {
    origin: PaymentOrigin;
    method: PaymentMethod;
    shiftSessionId: string | null;
    createdByUserId: string | null;
  };
}) {
  const target = Math.max(0, Math.trunc(args.targetGrossCents));
  const updates = allocateAmounts(args.lines, target);

  for (const update of updates) {
    if (update.amountCents > 0) {
      await args.tx.payment.update({
        where: { id: update.id },
        data: { amountCents: update.amountCents },
      });
    } else {
      await args.tx.payment.delete({ where: { id: update.id } });
    }
  }

  if (args.lines.length === 0 && target > 0) {
    await args.tx.payment.create({
      data: {
        reservationId: args.reservationId,
        origin: args.fallback.origin,
        method: args.fallback.method,
        amountCents: target,
        isDeposit: args.isDeposit,
        direction: args.direction,
        shiftSessionId: args.fallback.shiftSessionId,
        createdByUserId: args.fallback.createdByUserId,
      },
    });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const body = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          source: true,
          totalPriceCents: true,
          depositCents: true,
          basePriceCents: true,
          autoDiscountCents: true,
          manualDiscountCents: true,
          payments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              amountCents: true,
              isDeposit: true,
              direction: true,
              method: true,
              origin: true,
              shiftSessionId: true,
            },
          },
        },
      });

      if (!reservation) throw new Error("Reserva no existe");
      if (reservation.status === ReservationStatus.CANCELED) throw new Error("No se pueden ajustar importes de una reserva cancelada");

      const serviceInLines = reservation.payments.filter(
        (payment) => !payment.isDeposit && payment.direction === PaymentDirection.IN,
      );
      const serviceOutLines = reservation.payments.filter(
        (payment) => !payment.isDeposit && payment.direction === PaymentDirection.OUT,
      );
      const depositInLines = reservation.payments.filter(
        (payment) => payment.isDeposit && payment.direction === PaymentDirection.IN,
      );
      const depositOutLines = reservation.payments.filter(
        (payment) => payment.isDeposit && payment.direction === PaymentDirection.OUT,
      );

      const serviceOutGrossCents = serviceOutLines.reduce((sum, payment) => sum + payment.amountCents, 0);
      const depositInGrossCents = depositInLines.reduce((sum, payment) => sum + payment.amountCents, 0);
      const depositOutGrossCents = depositOutLines.reduce((sum, payment) => sum + payment.amountCents, 0);
      const currentNetDepositCents = depositInGrossCents - depositOutGrossCents;

      const targetServiceInGrossCents = body.totalPriceCents + serviceOutGrossCents;
      const targetNetDepositCents = clamp(currentNetDepositCents, 0, body.depositCents);
      const targetDepositInGrossCents = body.depositCents;
      const targetDepositOutGrossCents = Math.max(0, body.depositCents - targetNetDepositCents);

      const fallbackOrigin =
        reservation.payments[0]?.origin ??
        (reservation.source === PaymentOrigin.BOOTH ||
        reservation.source === PaymentOrigin.WEB ||
        reservation.source === PaymentOrigin.BAR
          ? reservation.source
          : PaymentOrigin.STORE);
      const fallbackMethod = reservation.payments[0]?.method ?? PaymentMethod.CARD;
      const fallbackShiftSessionId = reservation.payments[0]?.shiftSessionId ?? null;
      const fallback = {
        origin: fallbackOrigin,
        method: fallbackMethod,
        shiftSessionId: fallbackShiftSessionId,
        createdByUserId: session.userId,
      };

      await tx.reservation.update({
        where: { id },
        data: {
          basePriceCents: body.totalPriceCents,
          autoDiscountCents: 0,
          manualDiscountCents: 0,
          manualDiscountReason: null,
          promoCode: null,
          totalPriceCents: body.totalPriceCents,
          depositCents: body.depositCents,
          financialAdjustmentNote: body.note,
          financialAdjustedByUserId: session.userId,
          financialAdjustedAt: new Date(),
        },
      });

      await rebalancePaymentLinesTx({
        tx,
        lines: serviceInLines,
        targetGrossCents: targetServiceInGrossCents,
        reservationId: id,
        isDeposit: false,
        direction: PaymentDirection.IN,
        fallback,
      });

      await rebalancePaymentLinesTx({
        tx,
        lines: depositInLines,
        targetGrossCents: targetDepositInGrossCents,
        reservationId: id,
        isDeposit: true,
        direction: PaymentDirection.IN,
        fallback,
      });

      await rebalancePaymentLinesTx({
        tx,
        lines: depositOutLines,
        targetGrossCents: targetDepositOutGrossCents,
        reservationId: id,
        isDeposit: true,
        direction: PaymentDirection.OUT,
        fallback,
      });

      const mainItem = await tx.reservationItem.findFirst({
        where: { reservationId: id, isExtra: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, quantity: true },
      });

      if (mainItem) {
        const qty = Math.max(1, Number(mainItem.quantity ?? 1));
        await tx.reservationItem.update({
          where: { id: mainItem.id },
          data: {
            unitPriceCents: Math.round(body.totalPriceCents / qty),
            totalPriceCents: body.totalPriceCents,
          },
        });
      }

      await tx.operationalOverrideLog.create({
        data: {
          targetType: OperationalOverrideTarget.RESERVATION,
          action: OperationalOverrideAction.RESERVATION_FINANCIAL_ADJUSTMENT,
          targetId: id,
          reason: body.note,
          payloadJson: {
            before: {
              totalPriceCents: reservation.totalPriceCents,
              depositCents: reservation.depositCents,
              basePriceCents: reservation.basePriceCents,
              autoDiscountCents: reservation.autoDiscountCents,
              manualDiscountCents: reservation.manualDiscountCents,
              serviceInGrossCents: reservation.payments
                .filter((payment) => !payment.isDeposit && payment.direction === PaymentDirection.IN)
                .reduce((sum, payment) => sum + payment.amountCents, 0),
              serviceOutGrossCents,
              depositInGrossCents,
              depositOutGrossCents,
            },
            after: {
              totalPriceCents: body.totalPriceCents,
              depositCents: body.depositCents,
              serviceInGrossCents: targetServiceInGrossCents,
              serviceOutGrossCents,
              depositInGrossCents: targetDepositInGrossCents,
              depositOutGrossCents: targetDepositOutGrossCents,
            },
          },
          createdByUserId: session.userId,
        },
      });

      return { id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    return new NextResponse(error instanceof Error ? error.message : "No se pudo ajustar la reserva", { status: 400 });
  }
}
