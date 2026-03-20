// src/app/api/booth/taxiboat-trips/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const BodySchema = z.object({
  boat: z.enum(["TAXIBOAT_1", "TAXIBOAT_2"]).optional(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

const now = new Date();
const activityDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const max = await prisma.taxiboatTrip.aggregate({
  where: { activityDate, boat: parsed.data.boat ?? "TAXIBOAT_1" },
  _max: { tripNo: true },
});

const nextTripNo = (max._max.tripNo ?? 0) + 1;

const trip = await prisma.taxiboatTrip.create({
  data: {
    boat: parsed.data.boat ?? "TAXIBOAT_1",
    note: parsed.data.note ?? null,
    createdByUserId: session.userId,
    status: "OPEN",
    activityDate,
    tripNo: nextTripNo,
  },
  select: { id: true, boat: true, status: true, createdAt: true, tripNo: true },
});

  return NextResponse.json({ ok: true, trip });
}
