// src/app/api/booth/reservations/today/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { BUSINESS_TZ, tzDayRangeUtc } from "@/lib/tz-business";
import { ReservationStatus } from "@prisma/client";
import {
  resolveReservationActivitySummary,
  sumReservationActivityQuantity,
} from "@/lib/reservation-activity-summary";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start, endExclusive } = tzDayRangeUtc(BUSINESS_TZ);

  const rowsDb = await prisma.reservation.findMany({
    where: {
      source: "BOOTH",
      activityDate: { gte: start, lt: endExclusive },
      status: { not: ReservationStatus.CANCELED },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      boothCode: true,
      boothNote: true,
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
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          totalPriceCents: true,
          unitPriceCents: true,
          quantity: true,
          pax: true,
          isExtra: true,
          isPackParent: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
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
      if (p.origin !== "BOOTH" || p.isDeposit) return acc;
      const sign = p.direction === "OUT" ? -1 : 1;
      return acc + sign * Number(p.amountCents || 0);
    }, 0);

    // ✅ total a cobrar = totalPriceCents (final)
    const pendingCents = Math.max(0, Number(r.totalPriceCents ?? 0) - paidCents);

    // ✅ PVP “robusto”: si hay item principal, úsalo; si no, usa basePriceCents legacy
    const activitySummary = resolveReservationActivitySummary(r);
    const serviceTotalCents =
      r.items?.length > 0
        ? r.items
            .filter((item) => !item.isExtra && !item.isPackParent)
            .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0)
        : Number(r.basePriceCents ?? 0);

    return {
      id: r.id,
      boothCode: r.boothCode,
      boothNote: r.boothNote,
      arrivedStoreAt: r.arrivedStoreAt,
      received: !!r.arrivedStoreAt,

      createdAt: r.createdAt,
      taxiboatTripId: r.taxiboatTripId,
      taxiboatAssignedAt: r.taxiboatAssignedAt,
      taxiboatTrip: r.taxiboatTrip,

      customerName: r.customerName,
      customerCountry: r.customerCountry,
      pax: r.pax,
      quantity: sumReservationActivityQuantity(r),

      serviceName: activitySummary.serviceName,
      durationMinutes: activitySummary.durationMinutes,
      serviceCategory: activitySummary.serviceCategory,
      // ✅ claves para que la UI pueda resolver siempre
      serviceId: r.serviceId,
      optionId: r.optionId,
      service: r.service
        ? { ...r.service, name: activitySummary.serviceName ?? r.service.name }
        : activitySummary.serviceName
          ? { id: "", code: null, name: activitySummary.serviceName, category: activitySummary.serviceCategory }
          : null,
      option: r.option ? { ...r.option, durationMinutes: activitySummary.durationMinutes } : null,

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
      items: r.items ?? [],
    };
  });

  return NextResponse.json({ rows });
}
