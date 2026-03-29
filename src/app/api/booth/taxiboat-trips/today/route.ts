// src/app/api/booth/taxiboat-trips/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

  // ✅ OJO: prisma.taxiboatTrip (no prisma.TaxiboatTrip)
  const trips = await prisma.taxiboatTrip.findMany({
    where: {
      activityDate: { gte: start, lt: endExclusive },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      boat: true,
      status: true,
      createdAt: true,
      departedAt: true,
      note: true,
      createdByUserId: true,
      tripNo: true,
      reservations: {
        select: {
          id: true,
          boothCode: true,
          customerName: true,
          pax: true,
          quantity: true,
          arrivedStoreAt: true,
          service: { select: { name: true } },
          option: { select: { durationMinutes: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // opcional: métricas rápidas por viaje
  const tripsWithTotals = trips.map((t) => {
    const paxTotal = (t.reservations ?? []).reduce((acc, r) => acc + (r.pax ?? 0), 0);
    const motosTotal = (t.reservations ?? []).reduce((acc, r) => acc + (r.quantity ?? 0), 0);
    return { ...t, paxTotal, motosTotal };
  });

  return NextResponse.json({ ok: true, trips: tripsWithTotals });
}
