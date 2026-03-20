// src/app/api/booth/taxiboat-trips/assign/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const BodySchema = z.object({
  reservationId: z.string().min(1),
  tripId: z.string().min(1),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { reservationId, tripId } = parsed.data;

  // Solo reservas BOOTH y no recibidas
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, source: true, arrivedStoreAt: true },
  });
  if (!res || res.source !== "BOOTH") {
    return NextResponse.json({ error: "Reserva no válida" }, { status: 400 });
  }
  if (res.arrivedStoreAt) {
    return NextResponse.json({ error: "Ya está recibida en tienda" }, { status: 409 });
  }

  const trip = await prisma.taxiboatTrip.findUnique({
    where: { id: tripId },
    select: { id: true, status: true },
  });
  if (!trip || trip.status !== "OPEN") {
    return NextResponse.json({ error: "Viaje no OPEN" }, { status: 409 });
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { taxiboatTripId: tripId, taxiboatAssignedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
