import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const BodySchema = z.object({
  reservationId: z.string().min(1),
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

  const reservation = await prisma.reservation.findUnique({
    where: { id: parsed.data.reservationId },
    select: {
      id: true,
      source: true,
      arrivedStoreAt: true,
      taxiboatTripId: true,
      taxiboatTrip: {
        select: {
          status: true,
          departedAt: true,
        },
      },
    },
  });

  if (!reservation || reservation.source !== "BOOTH") {
    return NextResponse.json({ error: "Reserva no válida" }, { status: 400 });
  }

  if (!reservation.taxiboatTripId) {
    return NextResponse.json({ error: "La reserva no tiene viaje asignado" }, { status: 409 });
  }

  if (reservation.arrivedStoreAt) {
    return NextResponse.json({ error: "La reserva ya está recibida en tienda" }, { status: 409 });
  }

  if (!reservation.taxiboatTrip || reservation.taxiboatTrip.status !== "OPEN" || reservation.taxiboatTrip.departedAt) {
    return NextResponse.json({ error: "Solo se puede desasignar de viajes OPEN no salidos" }, { status: 409 });
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      taxiboatTripId: null,
      taxiboatAssignedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
