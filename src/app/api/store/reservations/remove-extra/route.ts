// src/app/api/store/reservations/remove-extra/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ReservationStatus } from "@prisma/client";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  itemId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

  const { reservationId, itemId, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirst({
        where: { id: reservationId },
        select: { id: true, status: true },
      });
      if (!r) throw new Error("Reserva no existe");

      const allowedStore: ReservationStatus[] = [
        ReservationStatus.WAITING,
        ReservationStatus.READY_FOR_PLATFORM,
        ReservationStatus.SCHEDULED,
        ReservationStatus.IN_SEA,
      ];
      const allowedAdmin: ReservationStatus[] = [...allowedStore, ReservationStatus.COMPLETED, ReservationStatus.CANCELED];

      const allowed = session.role === "ADMIN" ? allowedAdmin : allowedStore;

      if (!allowed.includes(r.status as ReservationStatus)) {
        throw new Error("No se pueden modificar extras en este estado");
      }

      if (r.status === ReservationStatus.COMPLETED || r.status === ReservationStatus.CANCELED) {
        if (session.role !== "ADMIN") {
          throw new Error("Solo ADMIN puede modificar extras post-cierre");
        }
        if (!reason || reason.trim().length < 3) {
          throw new Error("Indica un motivo para el ajuste post-cierre");
        }
      }

      const item = await tx.reservationItem.findFirst({
        where: { id: itemId, reservationId },
        select: { id: true, isExtra: true },
      });
      if (!item) throw new Error("Item no existe");
      if (!item.isExtra) throw new Error("No se puede borrar el item principal");

      await tx.reservationItem.delete({ where: { id: itemId } });

      const sum = await tx.reservationItem.aggregate({
        where: { reservationId },
        _sum: { totalPriceCents: true },
      });

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { totalPriceCents: sum._sum.totalPriceCents ?? 0 },
        select: { id: true, totalPriceCents: true },
      });

      return { reservation: updated };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error interno";
    return new NextResponse(message, { status: 400 });
  }
}


