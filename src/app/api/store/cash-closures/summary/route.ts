// src/app/api/store/cash-closures/summary/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentOrigin, ShiftName, RoleName } from "@prisma/client";
import { originFromRoleName, sumByMethod, parseBusinessDate, shiftWindow, isOriginSplitByShift, normalizeClosureShift } from "@/lib/cashClosures";

export const runtime = "nodejs";
const DEFAULT_CASH_FUND_CENTS = 10_000;

type CashFundMeta = {
  cashFundCents?: number;
  cashToKeepCents?: number;
  cashToWithdrawCents?: number;
};

function readCashFundMeta(value: unknown): CashFundMeta | null {
  if (!value || typeof value !== "object") return null;
  const meta = (value as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;

  const cashFundCents = Number((meta as { cashFundCents?: unknown }).cashFundCents);
  const cashToKeepCents = Number((meta as { cashToKeepCents?: unknown }).cashToKeepCents);
  const cashToWithdrawCents = Number((meta as { cashToWithdrawCents?: unknown }).cashToWithdrawCents);

  return {
    cashFundCents: Number.isFinite(cashFundCents) ? cashFundCents : undefined,
    cashToKeepCents: Number.isFinite(cashToKeepCents) ? cashToKeepCents : undefined,
    cashToWithdrawCents: Number.isFinite(cashToWithdrawCents) ? cashToWithdrawCents : undefined,
  };
}

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  shift: z.nativeEnum(ShiftName).optional(), // MORNING/AFTERNOON
  date: z.string().optional(), // YYYY-MM-DD (si no, hoy)
});

async function requireRoleForOrigin(origin: PaymentOrigin) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;

  if (session.role === "ADMIN") return session;

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (roleOrigin === origin) return session;

  return null;
}

function emptyByMethod() {
  return { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const parsed = Q.safeParse({
      origin: u.searchParams.get("origin"),
      shift: u.searchParams.get("shift") ?? undefined,
      date: u.searchParams.get("date") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

    const { origin, shift: shiftRaw, date } = parsed.data;

    const session = await requireRoleForOrigin(origin);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Si no viene shift, elegimos uno por defecto (pero mejor mandarlo siempre desde UI)
    const requestedShift: ShiftName = (shiftRaw ?? (session.shift as ShiftName) ?? "MORNING") as ShiftName;
    const shift = normalizeClosureShift(origin, requestedShift);
    const businessDate = parseBusinessDate(date);

    const { from, to } = shiftWindow(origin, businessDate, shift);
    const payments = await prisma.payment.findMany({
      where: isOriginSplitByShift(origin)
        ? {
            origin,
            OR: [
              {
                shiftSession: {
                  is: {
                    businessDate,
                    shift,
                  },
                },
              },
              {
                shiftSessionId: null,
                createdAt: { gte: from, lt: to },
              },
            ],
          }
        : {
            origin,
            createdAt: { gte: from, lt: to },
          },
      select: {
        amountCents: true,
        isDeposit: true,
        direction: true,
        method: true,
        giftVoucherSold: { select: { isVoided: true } },
        passSoldVoucher: { select: { isVoided: true } },
        passVoucherSale: { select: { isVoided: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const visiblePayments = payments.filter(
      (payment) =>
        !payment.giftVoucherSold?.isVoided &&
        !payment.passSoldVoucher?.isVoided &&
        !payment.passVoucherSale?.isVoided
    );

    const serviceIn = emptyByMethod();
    const serviceOut = emptyByMethod();
    const depositIn = emptyByMethod();
    const depositOut = emptyByMethod();

    for (const p of visiblePayments) {
      const bucket = p.isDeposit
        ? p.direction === "OUT"
          ? depositOut
          : depositIn
        : p.direction === "OUT"
        ? serviceOut
        : serviceIn;

      const m = p.method as keyof typeof serviceIn;
      bucket[m] = (bucket[m] ?? 0) + Number(p.amountCents || 0);
    }

    const net = (ins: Record<string, number>, outs: Record<string, number>) => {
      const res: Record<string, number> = {};
      let total = 0;
      for (const k of Object.keys(emptyByMethod())) {
        res[k] = (ins[k] ?? 0) - (outs[k] ?? 0);
        total += res[k];
      }
      return { byMethod: res, total };
    };

    const systemTotals = sumByMethod(
      visiblePayments.map((p) => ({
        amountCents: p.amountCents,
        direction: p.direction,
        method: p.method,
        isDeposit: p.isDeposit,
      }))
    );
    const serviceNet = net(serviceIn, serviceOut);
    const depositNet = net(depositIn, depositOut);

    const computed = {
      service: { IN: serviceIn, OUT: serviceOut, NET: serviceNet },
      deposit: { IN: depositIn, OUT: depositOut, NET: depositNet },
      all: { NET: serviceNet.total + depositNet.total },
      meta: { origin, shift, requestedShift, businessDate, windowFrom: from, windowTo: to },
    };

    const pendingStaffSummary =
      origin === "BAR"
        ? await prisma.barSale.aggregate({
            where: {
              staffMode: true,
              paymentId: null,
              soldAt: { gte: from, lt: to },
            },
            _sum: { totalRevenueCents: true },
            _count: { _all: true },
          })
        : null;

    // ¿ya está cerrado? (por origin+shift+día)
    const existing = await prisma.cashClosure.findFirst({
      where: {
        businessDate,
        origin,
        isVoided: false,
        ...(isOriginSplitByShift(origin) ? { shift } : {}),
      },
      orderBy: [{ closedAt: "desc" }],
      select: { id: true, closedAt: true, isVoided: true, computedJson: true },
    });

    const isClosed = Boolean(existing && !existing.isVoided);
    const currentFundMeta = existing ? readCashFundMeta(existing.computedJson) : null;

    const previousClosure = !existing
      ? await prisma.cashClosure.findFirst({
          where: {
            origin,
            isVoided: false,
            businessDate: { lt: businessDate },
            ...(isOriginSplitByShift(origin) ? { shift } : {}),
          },
          orderBy: [{ businessDate: "desc" }, { closedAt: "desc" }],
          select: { id: true, businessDate: true, computedJson: true },
        })
      : null;

    const previousFundMeta = previousClosure ? readCashFundMeta(previousClosure.computedJson) : null;
    const suggestedCashFundCents =
      currentFundMeta?.cashFundCents ??
      previousFundMeta?.cashFundCents ??
      DEFAULT_CASH_FUND_CENTS;

    return NextResponse.json({
      ok: true,
      computed,
      systemTotals, // ✅ listo para UI y para close
      pendingStaff: {
        count: Number(pendingStaffSummary?._count._all ?? 0),
        totalCents: Number(pendingStaffSummary?._sum.totalRevenueCents ?? 0),
      },
      isClosed,
      closure: existing
        ? {
            id: existing.id,
            closedAt: existing.closedAt,
            isVoided: existing.isVoided,
            cashFundCents: currentFundMeta?.cashFundCents ?? null,
            cashToKeepCents: currentFundMeta?.cashToKeepCents ?? null,
            cashToWithdrawCents: currentFundMeta?.cashToWithdrawCents ?? null,
          }
        : null,
      cashFundSuggestion: {
        defaultCents: DEFAULT_CASH_FUND_CENTS,
        suggestedCents: suggestedCashFundCents,
        source: existing
          ? "CURRENT_CLOSURE"
          : previousFundMeta?.cashFundCents != null
          ? "PREVIOUS_CLOSURE"
          : "DEFAULT",
        previousClosureId: previousClosure?.id ?? null,
        previousBusinessDate: previousClosure?.businessDate ?? null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


