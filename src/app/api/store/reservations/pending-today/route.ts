// src/app/api/store/reservations/pending-today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { buildStorePendingTodayWhere } from "@/lib/store-reservation-visibility";
import { getBusinessDayRange } from "@/lib/business-day";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

export async function GET() {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { start, endExclusive } = getBusinessDayRange();

  const rows = await prisma.reservation.findMany({
    where: buildStorePendingTodayWhere({ start, endExclusive }),
    orderBy: [{ scheduledTime: "asc" }, { activityDate: "asc" }],
    select: {
      id: true,
      customerName: true,
      activityDate: true,
      scheduledTime: true,
      service: { select: { name: true } },
      option: { select: { durationMinutes: true } },
      pax: true,
      quantity: true,
      channel: { select: { name: true } },
    },
  });

  return NextResponse.json({
    count: rows.length,
    rows,
    debug: {
      tz: process.env.BUSINESS_TZ || "Europe/Madrid",
      startUtc: start.toISOString(),
      endUtc: endExclusive.toISOString(),
    },
  });
}


