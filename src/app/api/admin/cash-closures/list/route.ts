// src/app/api/admin/cash-closures/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentOrigin, ShiftName } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getCashClosureCommissionSummary } from "@/lib/cash-closure-commissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin).optional(),
  shift: z.nativeEnum(ShiftName).optional(),
  date: z.string().min(10).max(10).optional(), // YYYY-MM-DD
  includeVoided: z.enum(["0", "1"]).optional(),
  take: z.string().optional(),
});

function parseBusinessDate(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00.000");
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin") ?? undefined,
    shift: u.searchParams.get("shift") ?? undefined,
    date: u.searchParams.get("date") ?? undefined,
    includeVoided: u.searchParams.get("includeVoided") ?? undefined,
    take: u.searchParams.get("take") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const take = Math.min(200, Math.max(20, Number(parsed.data.take ?? 80)));

  const where: Prisma.CashClosureWhereInput = {};
  if (parsed.data.origin) where.origin = parsed.data.origin;
  if (parsed.data.shift) where.shift = parsed.data.shift;
  if (parsed.data.date) where.businessDate = parseBusinessDate(parsed.data.date);
  if (parsed.data.includeVoided !== "1") where.isVoided = false;

  const rows = await prisma.cashClosure.findMany({
    where,
    take,
    orderBy: [{ businessDate: "desc" }, { closedAt: "desc" }],
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      windowFrom: true,
      windowTo: true,
      closedAt: true,
      isVoided: true,
      voidedAt: true,
      voidReason: true,
      note: true,
      reviewedAt: true,
      reviewNote: true,
      reviewedByUser: { select: { id: true, fullName: true, username: true } },
      closedByUser: { select: { id: true, fullName: true, username: true } },
      voidedByUser: { select: { id: true, fullName: true, username: true } },
      users: {
        select: {
          user: { select: { id: true, fullName: true, username: true } },
          roleNameAtClose: true,
        },
      },
      // totales resumidos para la tabla
      computedJson: true,
      declaredJson: true,
      systemJson: true,
      diffJson: true,
    },
  });

  const rowsWithDepositSummary = await Promise.all(
    rows.map(async (row) => {
      const commSummary = await getCashClosureCommissionSummary({
        closureId: row.id,
        origin: row.origin,
        windowFrom: row.windowFrom,
        windowTo: row.windowTo,
      });

      if (row.origin === "BOOTH") {
        return {
          ...row,
          totalCommissionCents: commSummary.totalCommissionCents,
          companyCommissionCents: commSummary.totalCompanyCommissionCents,
          channelCommissionCostCents: commSummary.totalChannelCommissionCostCents,
          depositSummary: {
            returnedCents: 0,
            retainedNetCents: 0,
            retainedCount: 0,
            partialRetentions: 0,
          },
          pendingStaffSummary: {
            totalCents: 0,
            count: 0,
          },
        };
      }

      const [depositPayments, heldReservations] = await Promise.all([
        prisma.payment.findMany({
          where: {
            createdAt: { gte: row.windowFrom, lt: row.windowTo },
            origin: row.origin,
            isDeposit: true,
          },
          select: {
            amountCents: true,
            direction: true,
          },
        }),
        prisma.reservation.findMany({
          where: {
            depositHeld: true,
            depositHeldAt: { gte: row.windowFrom, lt: row.windowTo },
            payments: {
              some: {
                origin: row.origin,
                isDeposit: true,
              },
            },
          },
          select: {
            payments: {
              where: {
                isDeposit: true,
                origin: row.origin,
              },
              select: {
                amountCents: true,
                direction: true,
              },
            },
          },
        }),
      ]);

      const returnedCents = depositPayments
        .filter((payment) => payment.direction === "OUT")
        .reduce((sum, payment) => sum + payment.amountCents, 0);

      const retained = heldReservations.map((reservation) => {
        const returned = reservation.payments
          .filter((payment) => payment.direction === "OUT")
          .reduce((sum, payment) => sum + payment.amountCents, 0);

        const netHeld = Math.max(
          0,
          reservation.payments.reduce(
            (sum, payment) =>
              sum + (payment.direction === "OUT" ? -payment.amountCents : payment.amountCents),
            0
          )
        );

        return {
          netHeld,
          isPartial: returned > 0 && netHeld > 0,
        };
      });

      const pendingStaffSummary =
        row.origin === "BAR"
          ? await prisma.barSale.aggregate({
              where: {
                staffMode: true,
                paymentId: null,
                soldAt: { gte: row.windowFrom, lt: row.windowTo },
              },
              _sum: { totalRevenueCents: true },
              _count: { _all: true },
            })
          : null;

      return {
        ...row,
        totalCommissionCents: commSummary.totalCommissionCents,
        companyCommissionCents: commSummary.totalCompanyCommissionCents,
        channelCommissionCostCents: commSummary.totalChannelCommissionCostCents,
        depositSummary: {
          returnedCents,
          retainedNetCents: retained.reduce((sum, item) => sum + item.netHeld, 0),
          retainedCount: retained.filter((item) => item.netHeld > 0).length,
          partialRetentions: retained.filter((item) => item.isPartial).length,
        },
        pendingStaffSummary: {
          totalCents: Number(pendingStaffSummary?._sum.totalRevenueCents ?? 0),
          count: Number(pendingStaffSummary?._count._all ?? 0),
        },
      };
    })
  );

  return NextResponse.json({ ok: true, rows: rowsWithDepositSummary });
}

