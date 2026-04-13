// src/app/api/booth/taxiboat-trips/depart/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { ensureTaxiboatOperations } from "@/lib/taxiboat-operations";

export const runtime = "nodejs";

const BodySchema = z.object({
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
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const tripId = parsed.data.tripId;
  await ensureTaxiboatOperations();

  const trip = await prisma.taxiboatTrip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      boat: true,
      status: true,
      departedAt: true,
      reservations: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!trip) return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
  if (trip.departedAt) return NextResponse.json({ ok: true, already: true });

  const operation = await prisma.taxiboatOperation.findUnique({
    where: { boat: trip.boat },
    select: { status: true },
  });

  if (!operation || operation.status !== "AT_BOOTH") {
    return NextResponse.json(
      { error: "El taxiboat no esta en Booth, no se puede iniciar la salida" },
      { status: 409 }
    );
  }

  const activeReservationsCount = trip.reservations.filter((reservation) => reservation.status !== "CANCELED").length;

  if (activeReservationsCount < 1) {
    return NextResponse.json(
      { error: "No se puede marcar salida sin clientes asignados. El viaje debe tener al menos 1 reserva." },
      { status: 409 }
    );
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.taxiboatTrip.update({
      where: { id: tripId },
      data: { status: "DEPARTED", departedAt: now },
    }),
    prisma.taxiboatOperation.update({
      where: { boat: trip.boat },
      data: {
        status: "TO_PLATFORM",
        departedBoothAt: now,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
