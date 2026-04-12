import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ReservationStatus } from "@prisma/client";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { computeAutoDiscountDetail } from "@/lib/discounts";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  itemId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const { reservationId, itemId, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirst({
        where: { id: reservationId },
        select: {
          id: true,
          status: true,
          source: true,
          manualDiscountCents: true,
          promoCode: true,
          customerCountry: true,
          channelId: true,
          serviceId: true,
          optionId: true,
        },
      });
      if (!r) throw new Error("Reserva no existe");

      const allowedStore: ReservationStatus[] = [
        ReservationStatus.WAITING,
        ReservationStatus.READY_FOR_PLATFORM,
        ReservationStatus.SCHEDULED,
        ReservationStatus.IN_SEA,
      ];
      const allowedAdmin: ReservationStatus[] = [
        ...allowedStore,
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELED,
      ];

      const allowed = session.role === "ADMIN" ? allowedAdmin : allowedStore;

      if (!allowed.includes(r.status as ReservationStatus)) {
        throw new Error("No se pueden modificar extras en este estado");
      }

      if (
        (r.status === ReservationStatus.COMPLETED ||
          r.status === ReservationStatus.CANCELED) &&
        session.role !== "ADMIN"
      ) {
        throw new Error("Solo ADMIN puede modificar extras post-cierre");
      }

      if (
        (r.status === ReservationStatus.COMPLETED ||
          r.status === ReservationStatus.CANCELED) &&
        (!reason || reason.trim().length < 3)
      ) {
        throw new Error("Indica un motivo para el ajuste post-cierre");
      }

      const item = await tx.reservationItem.findFirst({
        where: { id: itemId, reservationId },
        select: { id: true, isExtra: true },
      });
      if (!item) throw new Error("Item no existe");
      if (!item.isExtra) throw new Error("No se puede borrar el item principal");

      await tx.reservationItem.delete({ where: { id: itemId } });

      const [mainSum, allSum] = await Promise.all([
        tx.reservationItem.aggregate({
          where: { reservationId, isExtra: false },
          _sum: { totalPriceCents: true, quantity: true },
        }),
        tx.reservationItem.aggregate({
          where: { reservationId },
          _sum: { totalPriceCents: true },
        }),
      ]);

      const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0);
      const mainQuantity = Number(mainSum._sum.quantity ?? 1);
      const newTotal = Number(allSum._sum.totalPriceCents ?? 0);

      const isBoothReservation = r.source === "BOOTH";
      const channel = r.channelId
        ? await tx.channel.findUnique({ where: { id: r.channelId }, select: { allowsPromotions: true } })
        : null;
      const promotionsEnabled = isBoothReservation ? false : (channel ? Boolean(channel.allowsPromotions) : true);

      const mainSvc = await tx.service.findUnique({
        where: { id: r.serviceId },
        select: { category: true },
      });

      const autoDiscountCents = isBoothReservation
        ? 0
        : Number((await computeAutoDiscountDetail({
            when: new Date(),
            item: {
              serviceId: r.serviceId,
              optionId: r.optionId,
              category: mainSvc?.category ?? null,
              isExtra: false,
              lineBaseCents: serviceSubtotal,
              quantity: mainQuantity,
            },
            promoCode: promotionsEnabled ? (r.promoCode ?? null) : null,
            customerCountry: r.customerCountry ?? null,
            promotionsEnabled,
          })).discountCents ?? 0);

      const finalTotal = Math.max(
        0,
        newTotal - Number(r.manualDiscountCents ?? 0) - autoDiscountCents
      );

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          basePriceCents: serviceSubtotal,
          autoDiscountCents,
          promoCode: isBoothReservation ? null : r.promoCode ?? null,
          totalPriceCents: finalTotal,
        },
        select: { id: true, totalPriceCents: true },
      });

      await syncStoreFulfillmentTasksForReservation(tx, reservationId);

      return { reservation: updated };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error interno";
    return new NextResponse(message, { status: 400 });
  }
}
