import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";

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
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const trip = await prisma.taxiboatTrip.findUnique({
    where: { id: parsed.data.tripId },
    select: {
      id: true,
      status: true,
      departedAt: true,
      _count: {
        select: { reservations: true },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
  }

  if (trip.status !== "OPEN" || trip.departedAt) {
    return NextResponse.json({ error: "Solo se puede anular un viaje OPEN no salido" }, { status: 409 });
  }

  if (trip._count.reservations > 0) {
    return NextResponse.json(
      { error: "El viaje todavía tiene reservas asignadas. Desasígnalas antes de anularlo." },
      { status: 409 }
    );
  }

  await prisma.taxiboatTrip.delete({
    where: { id: trip.id },
  });

  return NextResponse.json({ ok: true });
}
