// src/app/api/booth/taxiboat-trips/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  // ✅ OJO: prisma.taxiboatTrip (no prisma.TaxiboatTrip)
  const trips = await prisma.taxiboatTrip.findMany({
    where: {
      createdAt: { gte: start, lt: end },
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
