// src/app/api/booth/reservation/create/route.ts
import { NextResponse } from "next/server";
import { ReservationSource, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";

const BodySchema = z.object({
  customerName: z.string().min(1),
  customerCountry: z.string().min(1),
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().min(1).max(4),
  pax: z.number().int().min(1).max(20),
  channelId: z.string().optional().nullable(), // por si quieres poner "Olimpic"
  discountEuros: z.union([z.string(), z.number()]).optional().nullable(),
});

function genBoothCode() {
  // PO-XXXX-XXX
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(100 + Math.random() * 900);
  return `PO-${a}-${b}`;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const activityDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ));



  // Generar código único (reintentos por colisión)
  let boothCode = "";
  for (let i = 0; i < 10; i++) {
    boothCode = genBoothCode();
    const exists = await prisma.reservation.findUnique({ where: { boothCode } }).catch(() => null);
    if (!exists) break;
  }
  if (!boothCode) return NextResponse.json({ error: "No se pudo generar código" }, { status: 500 });

// Calcula precio vigente desde ServicePrice (source of truth)
const now2 = new Date();

const price = await prisma.servicePrice.findFirst({
  where: {
    serviceId: parsed.data.serviceId,
    optionId: parsed.data.optionId, // ✅ clave nueva
    isActive: true,
    validFrom: { lte: now2 },
    OR: [{ validTo: null }, { validTo: { gt: now2 } }],
  },
  orderBy: { validFrom: "desc" },
  select: { basePriceCents: true },
});

// fallback legacy (por si algún option aún no tiene ServicePrice)
const opt = await prisma.serviceOption.findUnique({
  where: { id: parsed.data.optionId },
  select: { basePriceCents: true },
});
if (!opt) return NextResponse.json({ error: "Option no existe" }, { status: 400 });

const basePriceCents = Number(price?.basePriceCents ?? opt.basePriceCents ?? 0) || 0;

if (basePriceCents <= 0) {
  return NextResponse.json(
    { error: "Esta opción no tiene precio vigente (Admin > Precios)." },
    { status: 400 }
  );
}

const grossTotalCents = basePriceCents * parsed.data.quantity;

// descuento (euros -> cents)
const discountRaw = parsed.data.discountEuros ?? 0;
const discountNum = typeof discountRaw === "string"
  ? Number(discountRaw.replace(",", "."))
  : discountRaw;

const discountCents = Math.max(0, Math.round((Number.isFinite(discountNum) ? discountNum : 0) * 100));

// LÍMITE (ej: 30% del total bruto). Si luego quieres por usuario/rol, lo hacemos.
const maxDiscountCents = Math.floor(grossTotalCents * 0.3);
if (discountCents > maxDiscountCents) {
  return NextResponse.json(
    { error: `Descuento demasiado alto. Máximo: ${(maxDiscountCents / 100).toFixed(2)} €` },
    { status: 400 }
  );
}

const totalPriceCents = Math.max(0, grossTotalCents - discountCents);

  const r = await prisma.reservation.create({
    data: {
      source: ReservationSource.BOOTH,
      status: ReservationStatus.WAITING,
      activityDate,
      scheduledTime: null,
      channelId: parsed.data.channelId ?? null,

      serviceId: parsed.data.serviceId,
      optionId: parsed.data.optionId,
      quantity: parsed.data.quantity,
      pax: parsed.data.pax,

      basePriceCents,
      manualDiscountCents: discountCents,
      totalPriceCents,

      // mínimos de cliente
      customerName: parsed.data.customerName,
      customerCountry: parsed.data.customerCountry,

      // estos campos en tu modelo son obligatorios ahora mismo:
      // para “pre-reserva” los rellenamos con placeholders y luego TIENDA los sobreescribe al formalizar contrato.
      customerAddress: "-",
      customerDocType: "-",
      customerDocNumber: "-",

      // A5: columna boothCode (si la tienes)
      boothCode,
      boothCreatedAt: new Date(),
      boothCreatedByUserId: session.userId,
    },
    select: { id: true, boothCode: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, reservationId: r.id, boothCode: r.boothCode });
}
