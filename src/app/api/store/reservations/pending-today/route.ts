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

  const count = await prisma.reservation.count({
    where: buildStorePendingTodayWhere({ start, endExclusive }),
  });

  return NextResponse.json({ count });
}
