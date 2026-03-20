// src/app/api/booth/reservations/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

function startEndToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start, end } = startEndToday();

  const rowsDb = await prisma.reservation.findMany({
    where: {
      source: "BOOTH",
      activityDate: { gte: start, lte: end },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      boothCode: true,
      arrivedStoreAt: true,
      taxiboatTripId: true,
      taxiboatAssignedAt: true,
      createdAt: true,

      customerName: true,
      customerCountry: true,
      pax: true,
      quantity: true,
      serviceId: true,
      optionId: true,

      // ✅ descuentos y totales
      basePriceCents: true,
      manualDiscountCents: true,
      autoDiscountCents: true,
      manualDiscountReason: true,
      promoCode: true,
      totalPriceCents: true,

      service: { select: { id: true, code: true, name: true, category: true } },
      option: { select: { id: true, durationMinutes: true } },
      taxiboatTrip: { select: { id: true, boat: true, status: true, departedAt: true } },

      // ✅ items (principal)
      items: {
        where: { isExtra: false },
        orderBy: { createdAt: "asc" },
        select: {
          totalPriceCents: true,
          unitPriceCents: true,
          quantity: true,
          pax: true,
          service: { select: { name: true } },
          option: { select: { durationMinutes: true } },
        },
        take: 1,
      },

      payments: {
        select: {
          amountCents: true,
          direction: true,
          method: true,
          origin: true,
          createdAt: true,
          isDeposit: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const rows = rowsDb.map((r) => {
    const paidCents = (r.payments ?? []).reduce((acc, p) => {
      const sign = p.direction === "OUT" ? -1 : 1;
      return acc + sign * Number(p.amountCents || 0);
    }, 0);

    // ✅ total a cobrar = totalPriceCents (final)
    const pendingCents = Math.max(0, Number(r.totalPriceCents ?? 0) - paidCents);

    // ✅ PVP “robusto”: si hay item principal, úsalo; si no, usa basePriceCents legacy
    const mainItem = r.items?.[0] ?? null;
    const serviceTotalCents = mainItem ? Number(mainItem.totalPriceCents ?? 0) : Number(r.basePriceCents ?? 0);

    return {
      id: r.id,
      boothCode: r.boothCode,
      arrivedStoreAt: r.arrivedStoreAt,
      received: !!r.arrivedStoreAt,

      createdAt: r.createdAt,
      taxiboatTripId: r.taxiboatTripId,
      taxiboatAssignedAt: r.taxiboatAssignedAt,
      taxiboatTrip: r.taxiboatTrip,

      customerName: r.customerName,
      customerCountry: r.customerCountry,
      pax: r.pax,
      quantity: r.quantity,

      serviceName: mainItem?.service?.name ?? r.service?.name ?? null,
      durationMinutes: mainItem?.option?.durationMinutes ?? r.option?.durationMinutes ?? null,
      serviceCategory: r.service?.category ?? null,
      // ✅ claves para que la UI pueda resolver siempre
      serviceId: r.serviceId,
      optionId: r.optionId,
      service: r.service,   // { id, name, code }
      option: r.option,     // { id, durationMinutes }

      // ✅ para UI: PVP, descuento, final
      serviceTotalCents, // PVP base del principal (comisionable)
      basePriceCents: Number(r.basePriceCents ?? 0),
      manualDiscountCents: Number(r.manualDiscountCents ?? 0),
      autoDiscountCents: Number(r.autoDiscountCents ?? 0),
      promoCode: r.promoCode ?? null,
      manualDiscountReason: r.manualDiscountReason ?? null,
      totalPriceCents: Number(r.totalPriceCents ?? 0),

      // ✅ pagos
      paidCents,
      pendingCents,
      payments: r.payments ?? [],
    };
  });

  return NextResponse.json({ rows });
}
