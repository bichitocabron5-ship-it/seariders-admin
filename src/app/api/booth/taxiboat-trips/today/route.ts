// src/app/api/booth/taxiboat-trips/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import {
  resolveReservationActivitySummary,
  sumReservationActivityQuantity,
  sumReservationActivityQuantityForCategory,
} from "@/lib/reservation-activity-summary";

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
          status: true,
          boothCode: true,
          customerName: true,
          pax: true,
          quantity: true,
          arrivedStoreAt: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              quantity: true,
              isExtra: true,
              isPackParent: true,
              service: { select: { name: true, category: true } },
              option: { select: { durationMinutes: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // opcional: métricas rápidas por viaje
  const tripsWithTotals = trips.map((t) => {
    const reservations = (t.reservations ?? []).map((reservation) => {
      const activitySummary = resolveReservationActivitySummary(reservation);
      const quantity = sumReservationActivityQuantity(reservation);

      return {
        ...reservation,
        quantity,
        service: reservation.service
          ? { ...reservation.service, name: activitySummary.serviceName ?? reservation.service.name }
          : activitySummary.serviceName
            ? { name: activitySummary.serviceName, category: activitySummary.serviceCategory }
            : null,
        option: reservation.option
          ? { ...reservation.option, durationMinutes: activitySummary.durationMinutes }
          : null,
      };
    });
    const paxTotal = reservations.reduce((acc, r) => acc + (r.pax ?? 0), 0);
    const motosTotal = reservations.reduce(
      (acc, r) => acc + sumReservationActivityQuantityForCategory(r, "JETSKI"),
      0
    );
    return { ...t, reservations, paxTotal, motosTotal };
  });

  return NextResponse.json({ ok: true, trips: tripsWithTotals });
}
