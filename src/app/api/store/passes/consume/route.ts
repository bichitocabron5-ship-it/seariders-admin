// src/app/api/store/passes/consume/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { getPassVoucherPaidCents, getPassVoucherPendingCents } from "@/lib/pass-vouchers";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const MinutesPreset = z.union([z.literal(20), z.literal(30), z.literal(60), z.literal(120), z.literal(180)]);

const Body = z.object({
  code: z.string().min(3),

  minutesPreset: MinutesPreset.optional(),
  minutesToUse: z.number().int().min(5).max(600).optional(), // compat UI actual
  minutesOther: z.number().int().min(5).max(600).optional(), // ajusta

  activityDate: z.string().min(10).max(10),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  channelId: z.string().nullable().optional(),
}).refine((b) => {
  if (typeof b.minutesOther === "number") return true;
  if (typeof b.minutesToUse === "number") return true;
  return typeof b.minutesPreset === "number";
}, { message: "minutesPreset o minutesOther requerido" });

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();
  const minutesToUse =
    typeof parsed.data.minutesOther === "number"
      ? parsed.data.minutesOther
      : typeof parsed.data.minutesToUse === "number"
      ? parsed.data.minutesToUse
      : parsed.data.minutesPreset!;

  const tz = BUSINESS_TZ;
  const activityDate = utcDateFromYmdInTz(tz, parsed.data.activityDate);
  const scheduledTime = utcDateTimeFromYmdHmInTz(tz, parsed.data.activityDate, parsed.data.time);

  if (!scheduledTime) return new NextResponse("Hora inválida", { status: 400 });

  try {
    const out = await prisma.$transaction(async (tx) => {
      const v = await tx.passVoucher.findUnique({
        where: { code },
        select: {
          id: true,
          isVoided: true,
          expiresAt: true,
          salePriceCents: true,
          minutesRemaining: true,
          minutesTotal: true,

          buyerName: true,
          buyerPhone: true,
          buyerEmail: true,

          // PRO contrato
          customerCountry: true,
          customerAddress: true,
          customerDocType: true,
          customerDocNumber: true,
          soldPayment: { select: { amountCents: true, direction: true } },
          salePayments: { select: { amountCents: true, direction: true } },

          product: {
            select: {
              serviceId: true,
              optionId: true,
              option: {
                select: {
                  id: true,
                  durationMinutes: true,
                },
              },
            },
          },
        },
      });

      if (!v) throw new Error("Código no existe");
      if (v.isVoided) throw new Error("Bono anulado");
      if (v.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) throw new Error("Bono caducado");
      if (getPassVoucherPendingCents(v.salePriceCents, getPassVoucherPaidCents(v)) > 0) {
        throw new Error("No se puede canjear el bono completo hasta que esté totalmente pagado");
      }

      const remaining = Number(v.minutesRemaining ?? 0);
      if (remaining < minutesToUse) throw new Error(`Minutos insuficientes. Quedan ${remaining} min.`);

      // 1) descuento minutos + crear consume
      // 2) resolver optionId operativo según los minutos solicitados
      // Si el producto tiene una opción fija y coincide en duración, la reutilizamos.
      // Si no coincide, buscamos una opción activa del mismo servicio para esos minutos.
      let optionId = v.product.optionId ?? null;

      if (v.product.option?.durationMinutes !== minutesToUse) {
        const opt = await tx.serviceOption.findFirst({
          where: {
            serviceId: v.product.serviceId,
            durationMinutes: minutesToUse,
            isActive: true,
          },
          select: { id: true },
        });

        if (!opt) {
          throw new Error(
            `No existe una opción activa de ${minutesToUse} min para este servicio (configura ServiceOption o ajusta los minutos).`
          );
        }

        optionId = opt.id;
      }

      if (!optionId) {
        throw new Error("No se ha podido resolver la opción del servicio para este consumo");
      }

      // 3) descuento minutos + crear consume
      const consume = await tx.passConsume.create({
        data: {
          voucherId: v.id,
          serviceId: v.product.serviceId,
          optionId,
          minutesUsed: minutesToUse,
          consumedByUserId: session.userId,
        },
        select: { id: true },
      });

      await tx.passVoucher.update({
        where: { id: v.id },
        data: { minutesRemaining: remaining - minutesToUse },
        select: { id: true },
      });

      const reservation = await tx.reservation.create({
        data: {
          source: "STORE",
          status: "WAITING",
          activityDate,
          scheduledTime,
          storeQueueStartedAt: new Date(),
          paymentCompletedAt: new Date(),

          formalizedAt: null,
          formalizedByUserId: null,

          channelId: null, // tú dijiste que lo desactivas aquí

          serviceId: v.product.serviceId,
          optionId: optionId, // usar option resuelta por minutos si el producto no fija una
          quantity: 1,
          pax: 1,
          companionsCount: 0,

          // ya pagado por bono
          basePriceCents: 0,
          totalPriceCents: 0,
          depositCents: 0,

          // Cliente (copia PRO)
          customerName: (v.buyerName?.trim() ? v.buyerName.trim() : "Bono"),
          customerCountry: (v.customerCountry?.trim() ? v.customerCountry.trim().toUpperCase() : "ES"),

          customerPhone: v.buyerPhone?.trim() ? v.buyerPhone.trim() : null,
          customerEmail: v.buyerEmail?.trim() ? v.buyerEmail.trim() : null,

          customerAddress: v.customerAddress?.trim() ? v.customerAddress.trim() : null,
          customerDocType: v.customerDocType?.trim() ? v.customerDocType.trim() : null,
          customerDocNumber: v.customerDocNumber?.trim() ? v.customerDocNumber.trim() : null,

          passVoucherId: v.id,
          passConsumeId: consume.id,
        },
        select: { id: true },
      });

      // 4) item real a 0 EUR
      await tx.reservationItem.create({
        data: {
          reservationId: reservation.id,
          serviceId: v.product.serviceId,
          optionId: optionId,
          servicePriceId: null,
          quantity: 1,
          pax: 1,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isExtra: false,
        },
        select: { id: true },
      });

      // 5) link opcional consume -> reservation
      await tx.passConsume.update({
        where: { id: consume.id },
        data: { reservationId: reservation.id },
        select: { id: true },
      });

      return {
        reservationId: reservation.id,
        voucherId: v.id,
        consumeId: consume.id,

        minutesUsed: minutesToUse,
        minutesRemaining: remaining - minutesToUse,
        minutesTotal: Number(v.minutesTotal ?? 0),

        expiresAt: v.expiresAt ?? null,

        serviceId: v.product.serviceId,
        optionId, // el resuelto (string)

        customerName: v.buyerName?.trim() ? v.buyerName.trim() : "Bono",
      };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

