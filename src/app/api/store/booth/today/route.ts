// src/app/api/store/booth/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { ReservationStatus } from "@prisma/client";

export const runtime = "nodejs";

type BoothRow = {
  id: string;
  boothCode: string | null;
  arrivedStoreAt: Date | null;
  createdAt: Date;
  customerName: string | null;
  customerCountry: string | null;
  quantity: number | null;
  pax: number | null;
  totalPriceCents: number | null;
  service: { name: string } | null;
  option: { durationMinutes: number } | null;
  taxiboatAssignedAt: Date | null;
  taxiboatTripId: string | null;
  taxiboatTrip: {
    id: string;
    boat: string;
    tripNo: number | null;
    departedAt: Date | null;
    status: string;
  } | null;
};

export async function GET() {
  // Seguridad: solo STORE o ADMIN
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

  // 1) Traer reservas BOOTH del día + info del viaje
  const rowsDb = await prisma.reservation.findMany({
    where: {
      source: "BOOTH",
      activityDate: { gte: start, lt: endExclusive },
      boothCode: { not: null },
      status: { not: ReservationStatus.CANCELED },
    },
    select: {
      id: true,
      boothCode: true,
      arrivedStoreAt: true,
      createdAt: true,

      customerName: true,
      customerCountry: true,
      quantity: true,
      pax: true,
      totalPriceCents: true,

      service: { select: { name: true } },
      option: { select: { durationMinutes: true } },

      taxiboatAssignedAt: true,
      taxiboatTripId: true,

      // Esto es la clave para boat + tripNo + departedAt
      taxiboatTrip: {
        select: {
          id: true,
          boat: true,
          tripNo: true,
          departedAt: true,
          status: true,
        },
      },
    },
    orderBy: [{ arrivedStoreAt: "asc" }, { createdAt: "desc" }],
  });

  // 2) Aplanar para el frontend (para que page.tsx lo use directo)
  const rows = rowsDb.map((r: BoothRow) => ({
    ...r,
    taxiboatBoat: r.taxiboatTrip?.boat ?? null,
    taxiboatTripNo: r.taxiboatTrip?.tripNo ?? null,
    taxiboatDepartedAt: r.taxiboatTrip?.departedAt ?? null,
  }));

  // 3) (Opcional) Construir estadoLabel por si lo quieres usar en UI
  const mapped = rows.map((r) => {
    const preparing = !!r.taxiboatTripId && !r.taxiboatTrip?.departedAt && !r.arrivedStoreAt;
    const enCamino = !!r.taxiboatTrip?.departedAt && !r.arrivedStoreAt;
    const recibido = !!r.arrivedStoreAt;

    const statusLabel = recibido
      ? "RECIBIDO"
      : enCamino
      ? "EN CAMINO"
      : preparing
      ? "PREPARANDO"
      : "SIN VIAJE";

    return { ...r, statusLabel };
  });

  // 4) (Opcional) Agrupar EN CAMINO por viaje
  const groupsByTrip: Record<string, { tripId: string; boat: string; tripNo: number | null; departedAt: Date | null; paxTotal: number; reservations: typeof mapped }> = {};
  for (const r of mapped) {
    if (!r.taxiboatTrip?.id) continue;
    if (r.statusLabel !== "EN CAMINO") continue;

    const key = r.taxiboatTrip.id;
    if (!groupsByTrip[key]) {
      groupsByTrip[key] = {
        tripId: r.taxiboatTrip.id,
        boat: r.taxiboatTrip.boat,
        tripNo: r.taxiboatTrip.tripNo ?? null,
        departedAt: r.taxiboatTrip.departedAt ?? null,
        paxTotal: 0,
        reservations: [],
      };
    }
    groupsByTrip[key].paxTotal += Number(r.pax ?? 0);
    groupsByTrip[key].reservations.push(r);
  }

  const enCaminoTrips = Object.values(groupsByTrip).sort((a, b) => {
    const ta = a.departedAt ? new Date(a.departedAt).getTime() : 0;
    const tb = b.departedAt ? new Date(b.departedAt).getTime() : 0;
    return tb - ta;
  });

  const recibidas = mapped.filter((r) => r.statusLabel === "RECIBIDO");

  // Respuesta final sin returns intermedios
  return NextResponse.json({
    rows: mapped,      // tu page.tsx ya puede leer taxiboatTripNo
    enCaminoTrips,     // por si lo usas
    recibidas,         // por si lo usas
  });
}

