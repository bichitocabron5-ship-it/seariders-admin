// src/app/api/admin/cash-closures/[closureId]/commissions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import {
  commissionFromBase,
  proportionalCommissionBaseForCollected,
  resolveCommissionRate,
} from "@/lib/commission";
import { PaymentOrigin } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ closureId: string }> };

function signed(amountCents: number, direction: string) {
  return direction === "OUT" ? -Math.abs(amountCents) : Math.abs(amountCents);
}

export async function GET(req: Request, { params }: Ctx) {
  const { closureId } = await params;

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const closure = await prisma.cashClosure.findUnique({
    where: { id: closureId },
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      windowFrom: true,
      windowTo: true,
      isVoided: true,
    },
  });
  if (!closure) return NextResponse.json({ error: "Cierre no existe" }, { status: 404 });
  if (closure.isVoided) return NextResponse.json({ error: "Cierre anulado" }, { status: 400 });

  const payments = await prisma.payment.findMany({
    where: {
      origin: closure.origin as PaymentOrigin,
      createdAt: { gte: closure.windowFrom, lt: closure.windowTo },
      OR: [{ reservationId: { not: null } }, { reservationId: null, channelId: { not: null }, serviceId: { not: null } }],
    },
    select: {
      reservationId: true,
      serviceId: true,
      channelId: true,
      amountCents: true,
      commissionBaseCents: true,
      isExternalCommissionOnly: true,
      externalGrossAmountCents: true,
      direction: true,
      isDeposit: true,
      channel: {
        select: {
          id: true,
          name: true,
          kind: true,
          commissionEnabled: true,
          commissionAppliesToDeposit: true,
          commissionBps: true,
          commissionPct: true,
          commissionRules: {
            where: { isActive: true },
            select: { serviceId: true, commissionPct: true },
          },
        },
      },
    },
  });

  const reservationIds = Array.from(new Set(payments.map((p) => p.reservationId!).filter(Boolean)));

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: reservationIds } },
    select: {
      id: true,
      serviceId: true,
      totalPriceCents: true,
      commissionBaseCents: true,
      channelId: true,
      channel: {
        select: {
          id: true,
          name: true,
          kind: true,
          commissionEnabled: true,
          commissionAppliesToDeposit: true,
          commissionBps: true,
          commissionPct: true,
          commissionRules: {
            where: { isActive: true },
            select: { serviceId: true, commissionPct: true },
          },
        },
      },
    },
  });

  const netServiceByRes = new Map<string, number>();
  const netDepositByRes = new Map<string, number>();

  for (const p of payments) {
    const rid = p.reservationId!;
    const amt = signed(p.amountCents, p.direction);
    if (p.isDeposit) netDepositByRes.set(rid, (netDepositByRes.get(rid) ?? 0) + amt);
    else netServiceByRes.set(rid, (netServiceByRes.get(rid) ?? 0) + amt);
  }

  const byChannel = new Map<
    string,
    {
      channelId: string;
      name: string;
      baseServiceCents: number;
      baseDepositCents: number;
      baseTotalCents: number;
      commissionCents: number;
      reservations: number;
    }
  >();

  let totalCommissionCents = 0;

  for (const r of reservations) {
    const ch = r.channel;
    if (!ch || !ch.commissionEnabled) continue;

    const rate = resolveCommissionRate({
      channel: ch,
      serviceId: r.serviceId,
    });
    if (!rate) continue;

    const rawNetService = netServiceByRes.get(r.id) ?? 0;
    const baseService =
      Number(r.commissionBaseCents ?? 0) > 0 && Number(r.totalPriceCents ?? 0) > 0
        ? proportionalCommissionBaseForCollected({
            collectedNetCents: rawNetService,
            reservationNetCents: Number(r.totalPriceCents ?? 0),
            reservationCommissionBaseCents: Number(r.commissionBaseCents ?? 0),
          })
        : rawNetService;
    const baseDeposit = netDepositByRes.get(r.id) ?? 0;
    const baseTotal = baseService + (ch.commissionAppliesToDeposit ? baseDeposit : 0);

    if (!baseTotal) continue;

    const c = commissionFromBase(baseTotal, rate);
    totalCommissionCents += c;

    if (!byChannel.has(ch.id)) {
      byChannel.set(ch.id, {
        channelId: ch.id,
        name: ch.name,
        baseServiceCents: 0,
        baseDepositCents: 0,
        baseTotalCents: 0,
        commissionCents: 0,
        reservations: 0,
      });
    }

    const row = byChannel.get(ch.id)!;
    row.baseServiceCents += baseService;
    row.baseDepositCents += baseDeposit;
    row.baseTotalCents += baseTotal;
    row.commissionCents += c;
    row.reservations += 1;
  }

  for (const p of payments) {
    if (p.reservationId || !p.channelId || !p.serviceId) continue;

    const ch = p.channel;
    if (!ch || !ch.commissionEnabled) continue;

    if (p.isExternalCommissionOnly) {
      const commissionOnlyAmount = signed(p.amountCents, p.direction);
      if (!commissionOnlyAmount) continue;

      totalCommissionCents += commissionOnlyAmount;

      if (!byChannel.has(ch.id)) {
        byChannel.set(ch.id, {
          channelId: ch.id,
          name: ch.name,
          baseServiceCents: 0,
          baseDepositCents: 0,
          baseTotalCents: 0,
          commissionCents: 0,
          reservations: 0,
        });
      }

      const row = byChannel.get(ch.id)!;
      const grossBase = signed(p.commissionBaseCents ?? p.externalGrossAmountCents ?? p.amountCents, p.direction);
      if (p.isDeposit) row.baseDepositCents += grossBase;
      else row.baseServiceCents += grossBase;
      row.baseTotalCents += grossBase;
      row.commissionCents += commissionOnlyAmount;
      row.reservations += 1;
      continue;
    }

    const baseTotal = p.isDeposit && !ch.commissionAppliesToDeposit ? 0 : signed(p.commissionBaseCents ?? p.amountCents, p.direction);
    if (!baseTotal) continue;

    const c = commissionFromBase(
      baseTotal,
      resolveCommissionRate({
        channel: ch,
        serviceId: p.serviceId,
      })
    );
    if (!c) continue;

    totalCommissionCents += c;

    if (!byChannel.has(ch.id)) {
      byChannel.set(ch.id, {
        channelId: ch.id,
        name: ch.name,
        baseServiceCents: 0,
        baseDepositCents: 0,
        baseTotalCents: 0,
        commissionCents: 0,
        reservations: 0,
      });
    }

    const row = byChannel.get(ch.id)!;
    if (p.isDeposit) row.baseDepositCents += baseTotal;
    else row.baseServiceCents += baseTotal;
    row.baseTotalCents += baseTotal;
    row.commissionCents += c;
    row.reservations += 1;
  }

  return NextResponse.json({
    ok: true,
    meta: {
      closureId: closure.id,
      origin: closure.origin,
      shift: closure.shift,
      businessDate: closure.businessDate,
      windowFrom: closure.windowFrom,
      windowTo: closure.windowTo,
      reservations: reservations.length,
    },
    totalCommissionCents,
    rows: Array.from(byChannel.values()).sort((a, b) => b.commissionCents - a.commissionCents),
  });
}

