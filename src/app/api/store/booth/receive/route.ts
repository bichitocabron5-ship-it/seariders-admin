// src/app/api/store/booth/receive/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ReservationSource } from "@prisma/client";

export const runtime = "nodejs";

const BodySchema = z.object({
  boothCode: z.string().min(1),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const boothCode = parsed.data.boothCode.trim().toUpperCase();

  const res = await prisma.reservation.findFirst({
    where: { boothCode, source: ReservationSource.BOOTH },
    select: {
      id: true,
      arrivedStoreAt: true,
      boothCreatedAt: true,
      formalizedAt: true,
    },
  });

  if (!res) return NextResponse.json({ error: "Codigo no encontrado" }, { status: 404 });

  // caducidad 48h
  const EXP_HOURS = 48;
  if (res.boothCreatedAt) {
    const expireAt = new Date(res.boothCreatedAt.getTime() + EXP_HOURS * 60 * 60 * 1000);
    if (new Date() > expireAt) {
      return NextResponse.json({ error: "Codigo caducado", expired: true }, { status: 410 });
    }
  }

  if (!res.arrivedStoreAt) {
    await prisma.reservation.update({
      where: { id: res.id },
      data: { arrivedStoreAt: new Date() },
      select: { id: true },
    });
  }

  return NextResponse.json({
    ok: true,
    reservationId: res.id,
    already: Boolean(res.arrivedStoreAt),
    alreadyFormalized: Boolean(res.formalizedAt),
  });
}
