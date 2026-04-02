// src/app/api/booth/taxiboat-trips/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";
import { ensureTaxiboatOperations } from "@/lib/taxiboat-operations";

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

const activityDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ));
const boat = parsed.data.boat ?? "TAXIBOAT_1";

await ensureTaxiboatOperations();

const [operation, openTrip] = await Promise.all([
  prisma.taxiboatOperation.findUnique({
    where: { boat },
    select: { status: true },
  }),
  prisma.taxiboatTrip.findFirst({
    where: {
      activityDate,
      boat,
      status: "OPEN",
    },
    select: { id: true, tripNo: true },
  }),
]);

if (!operation || operation.status !== "AT_BOOTH") {
  return NextResponse.json(
    { error: "Ese taxiboat no esta en Booth y no puede prepararse para una nueva salida" },
    { status: 409 }
  );
}

if (openTrip) {
  return NextResponse.json(
    { error: `Ese taxiboat ya tiene un viaje OPEN (viaje ${openTrip.tripNo ?? "-"})` },
    { status: 409 }
  );
}

const max = await prisma.taxiboatTrip.aggregate({
  where: { activityDate, boat },
  _max: { tripNo: true },
});

const nextTripNo = (max._max.tripNo ?? 0) + 1;

const trip = await prisma.taxiboatTrip.create({
  data: {
    boat,
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
