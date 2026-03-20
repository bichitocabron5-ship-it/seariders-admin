// src/app/api/booth/taxiboat-trips/depart/route.ts
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
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const tripId = parsed.data.tripId;

  const trip = await prisma.taxiboatTrip.findUnique({
    where: { id: tripId },
    select: { id: true, status: true, departedAt: true },
  });

  if (!trip) return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
  if (trip.departedAt) return NextResponse.json({ ok: true, already: true });

  await prisma.taxiboatTrip.update({
    where: { id: tripId },
    data: { status: "DEPARTED", departedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
