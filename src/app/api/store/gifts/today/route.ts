// src/app/api/store/gifts/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const d0 = startOfToday();

  // vendidos hoy + canjeados hoy + pendientes (no canjeados y no anulados)
  const [soldToday, redeemedToday, pending] = await Promise.all([
    prisma.giftVoucher.findMany({
      where: { soldAt: { gte: d0 }, isVoided: false },
      orderBy: { soldAt: "desc" },
      select: {
        id: true,
        code: true,
        soldAt: true,
        buyerName: true,
        buyerPhone: true,
        redeemedAt: true,
        expiresAt: true,
        product: { select: { name: true, priceCents: true } },
      },
      take: 200,
    }),
    prisma.giftVoucher.findMany({
      where: { redeemedAt: { gte: d0 }, isVoided: false },
      orderBy: { redeemedAt: "desc" },
      select: {
        id: true,
        code: true,
        redeemedAt: true,
        redeemedReservationId: true,
        product: { select: { name: true, priceCents: true } },
      },
      take: 200,
    }),
    prisma.giftVoucher.findMany({
      where: { redeemedAt: null, isVoided: false },
      orderBy: { soldAt: "desc" },
      select: {
        id: true,
        code: true,
        soldAt: true,
        buyerName: true,
        buyerPhone: true,
        expiresAt: true,
        product: { select: { name: true, priceCents: true } },
      },
      take: 200,
    }),
  ]);

  return NextResponse.json({ ok: true, soldToday, redeemedToday, pending });
}

