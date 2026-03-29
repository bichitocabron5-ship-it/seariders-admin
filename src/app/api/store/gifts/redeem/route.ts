// src/app/api/store/gifts/redeem/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { BUSINESS_TZ, utcDateFromYmdInTz } from "@/lib/tz-business";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const Body = z.object({
  code: z.string().min(3),
  customerCountry: z.string().min(2).max(2).optional().nullable(), // default "ES"
});

function ymdInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(date); // YYYY-MM-DD
}

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();
  const customerCountry = (parsed.data.customerCountry ?? "ES").toUpperCase();

  try {
    const out = await prisma.$transaction(async (tx) => {
      const v = await tx.giftVoucher.findUnique({
        where: { code },
        select: {
          id: true,
          isVoided: true,
          redeemedAt: true,
          redeemedByUserId: true,
          redeemedReservationId: true,
          expiresAt: true,
          buyerName: true,
          buyerPhone: true,
          product: { select: { serviceId: true, optionId: true } },
        },
      });

      if (!v) throw new Error("Codigo no existe");
      if (v.isVoided) throw new Error("Voucher anulado");
      if (v.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) throw new Error("Voucher caducado");

      const now = new Date();
      const existingReservation = await tx.reservation.findUnique({
        where: { giftVoucherId: v.id },
        select: { id: true },
      });

      // Idempotencia y auto-reparaciÃ³n para datos antiguos/inconsistentes:
      // si ya existe reserva del voucher, devolvemos esa reserva y alineamos campos del voucher.
      if (existingReservation) {
        const fixData: {
          redeemedAt?: Date;
          redeemedByUserId?: string;
          redeemedReservationId?: string;
        } = {};

        if (!v.redeemedAt) fixData.redeemedAt = now;
        if (!v.redeemedByUserId) fixData.redeemedByUserId = session.userId;
        if (v.redeemedReservationId !== existingReservation.id) fixData.redeemedReservationId = existingReservation.id;

        if (Object.keys(fixData).length > 0) {
          await tx.giftVoucher.update({
            where: { id: v.id },
            data: fixData,
          });
        }

        return { reservationId: existingReservation.id };
      }

      if (v.redeemedAt) throw new Error("Voucher ya canjeado");

      // Reclamo atómico del voucher para evitar doble canje concurrente.
      const claimed = await tx.giftVoucher.updateMany({
        where: { id: v.id, isVoided: false, redeemedAt: null },
        data: {
          redeemedAt: now,
          redeemedByUserId: session.userId,
        },
      });
      if (claimed.count !== 1) throw new Error("Voucher ya canjeado");

      // âœ… reserva "draft": NO entra en /reservations/today (porque formalizedAt null)
      // activityDate: hoy (inicio dÃ­a en tz negocio). scheduledTime: null hasta formalizar.
      const ymd = ymdInTz(now, BUSINESS_TZ);
      const activityDate = utcDateFromYmdInTz(BUSINESS_TZ, ymd);

      const reservation = await tx.reservation.create({
        data: {
          source: "STORE",
          status: "WAITING",

          activityDate,
          scheduledTime: null, // ðŸ‘ˆ importante
          storeQueueStartedAt: now,
          paymentCompletedAt: now,

          serviceId: v.product.serviceId,
          optionId: v.product.optionId,

          quantity: 1,
          pax: 1,

          // no ponemos total definitivo aquÃ­
          basePriceCents: 0,
          totalPriceCents: 0,

          customerName: v.buyerName?.trim() || "Regalo",
          customerCountry,
          customerPhone: v.buyerPhone?.trim() || null,

          // metadata
          giftVoucherId: v.id,
        },
        select: { id: true },
      });

      // âœ… item real (actividad) a 0â‚¬ (pagado por regalo)
      await tx.reservationItem.create({
        data: {
          reservationId: reservation.id,
          serviceId: v.product.serviceId,
          optionId: v.product.optionId,
          servicePriceId: null,
          quantity: 1,
          pax: 1,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isExtra: false,
        },
        select: { id: true },
      });

      await tx.giftVoucher.update({
        where: { id: v.id },
        data: { redeemedReservationId: reservation.id },
      });

      return { reservationId: reservation.id };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

