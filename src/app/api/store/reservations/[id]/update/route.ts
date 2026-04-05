// src/app/api/store/reservations/[id]/update/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeAutoDiscountDetail } from "@/lib/discounts";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

type PriceReader = { servicePrice: Prisma.TransactionClient["servicePrice"] };

async function findVigentePrice(tx: PriceReader, params: { serviceId: string; optionId: string; durationMinutes: number; now: Date }) {
  const { serviceId, optionId, durationMinutes, now } = params;

  let price = await tx.servicePrice.findFirst({
    where: {
      serviceId,
      optionId,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { id: true, basePriceCents: true },
  });

  if (!price) {
    price = await tx.servicePrice.findFirst({
      where: {
        serviceId,
        optionId: null,
        durationMin: durationMinutes,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });
  }

  return price; // {id, basePriceCents} | null
}

function capManual30(totalBeforeDiscountsCents: number, manualDiscountCents: number) {
  const maxManual = Math.floor((totalBeforeDiscountsCents * 30) / 100);
  return Math.max(0, Math.min(Math.max(0, manualDiscountCents || 0), maxManual));
}

// mismo contrato que formalize
const NullableStr = z.string().optional().nullable();

const ItemBody = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  pax: z.number().int().min(1).max(50),
  promoCode: z.preprocess(
    (v) => {
      if (v == null) return null;
      const t = String(v).trim().toUpperCase();
      return t.length ? t : null;
    },
    z.string().min(1).max(50).nullable().optional()
  ),
});

const Body = z.object({
  pax: z.number().int().min(1).max(50),
  isLicense: z.boolean(),
  channelId: z.string().nullable().optional(),
  activityDate: z.string().min(10).max(10),
  time: z.string().min(5).max(5).nullable().optional(),
  

  // opcionales cliente/licencia (tu semántica undefined/no tocar)
  customerPhone: NullableStr,
  customerEmail: NullableStr,
  customerCountry: NullableStr,
  customerAddress: NullableStr,
  customerPostalCode: NullableStr,
  customerBirthDate: z.string().datetime().optional().nullable(),
  customerDocType: NullableStr,
  customerDocNumber: NullableStr,
  marketing: NullableStr,
  licenseSchool: NullableStr,
  licenseType: NullableStr,
  licenseNumber: NullableStr,

  // NUEVO PRO
  items: z.array(ItemBody).optional(),
  companionsCount: z.number().int().min(0).max(20).optional(),

  // compat legacy (si no mandas items)
  serviceId: z.string().min(1).optional(),
  optionId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99).optional(),

  // (opcional) si quieres permitir actualizar descuento manual aquí
  manualDiscountCents: z.number().int().min(0).max(1_000_000).optional(),
  manualDiscountReason: z.string().max(200).nullable().optional(),
});

// igual que formalize
function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null;          // borrar
  const t = String(v).trim();
  return t.length ? t : undefined;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const json = await req.json().catch(() => null);

  // seguridad: no permitir editar nombre
  if (json && typeof json === "object" && "customerName" in json) {
    return new NextResponse("No se permite editar el nombre", { status: 400 });
  }
  
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const b = parsed.data;

  const existing = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      serviceId: true,
      optionId: true,
      quantity: true,
      isLicense: true,
      channelId: true,
      activityDate: true,
      scheduledTime: true,
      customerCountry: true,

      // para merge correcto
      customerPhone: true,
      customerEmail: true,
      customerAddress: true,
      customerPostalCode: true,
      customerBirthDate: true,
      customerDocType: true,
      customerDocNumber: true,
      marketing: true,

      // licencia actual
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,

      manualDiscountCents: true,
      isPackParent: true,
    },
  });
  if (!existing) return new NextResponse("Reserva no existe", { status: 404 });

const hasProItems = Array.isArray(b.items) && b.items.length > 0;

if (hasProItems) {
  // Si es pack padre, no debería permitir editar items aquí.
  const existingPack = await prisma.reservation.findUnique({
    where: { id },
    select: { isPackParent: true, packId: true, manualDiscountCents: true, customerCountry: true },
  });
  if (!existingPack) return new NextResponse("Reserva no existe", { status: 404 });
  if (existingPack.isPackParent && existingPack.packId) {
    return new NextResponse("Los packs se editan como pack (no se puede cambiar composición aquí).", { status: 400 });
  }

  const now = new Date();

  // Resolver services/options en batch
  const serviceIds = Array.from(new Set(b.items!.map(x => x.serviceId)));
  const optionIds = Array.from(new Set(b.items!.map(x => x.optionId)));

  const [svcs, opts] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, category: true },
    }),
    prisma.serviceOption.findMany({
      where: { id: { in: optionIds } },
      select: { id: true, serviceId: true, durationMinutes: true },
    }),
  ]);

  const svcById = new Map(svcs.map(s => [s.id, s]));
  const optById = new Map(opts.map(o => [o.id, o]));

  // Validaciones fuertes
  for (const it of b.items!) {
    const svc = svcById.get(it.serviceId);
    if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

    const opt = optById.get(it.optionId);
    if (!opt) return new NextResponse("Opción no existe", { status: 400 });

    if (opt.serviceId !== svc.id) {
      return new NextResponse("La opción no pertenece al servicio", { status: 400 });
    }
  }

  // Recalcular totales, descuentos, fianza
  // (precio por línea por servicePrice vigente)
  const priced = [];
  for (const it of b.items!) {
    const opt = optById.get(it.optionId)!;
    const price = await findVigentePrice(prisma, { // lo cambiamos dentro de la tx más abajo
      serviceId: it.serviceId,
      optionId: it.optionId,
      durationMinutes: Number(opt.durationMinutes ?? 30),
      now,
    });
    // En PRO, lo correcto es hacerlo dentro de la tx. Lo recalculo más abajo.
    priced.push({ it, durationMinutes: Number(opt.durationMinutes ?? 30), price });
  }

  const result = await prisma.$transaction(async (tx) => {
    // recalcular dentro de la tx
    const lineCreates: Array<{
      serviceId: string;
      optionId: string;
      quantity: number;
      pax: number;
      promoCode: string | null;
      servicePriceId: string;
      unitPriceCents: number;
      totalPriceCents: number;
      category: string;
    }> = [];

    for (const it of b.items!) {
      const svc = svcById.get(it.serviceId)!;
      const opt = optById.get(it.optionId)!;

      const price = await findVigentePrice(tx, {
        serviceId: it.serviceId,
        optionId: it.optionId,
        durationMinutes: Number(opt.durationMinutes ?? 30),
        now,
      });

      if (!price) throw new Error("Este servicio/opción no tiene precio vigente (Admin > Precios).");

      const unitPriceCents = Number(price.basePriceCents) || 0;
      const qty = Math.max(1, Number(it.quantity || 1));
      const lineTotal = unitPriceCents * qty;

      lineCreates.push({
        serviceId: it.serviceId,
        optionId: it.optionId,
        quantity: qty,
        pax: Math.max(1, Number(it.pax || b.pax)),
        promoCode: String(it.promoCode ?? "").trim().toUpperCase() || null,
        servicePriceId: price.id,
        unitPriceCents,
        totalPriceCents: lineTotal,
        category: String(svc.category ?? "UNKNOWN").toUpperCase(),
      });
    }

    // Borrar items reales antiguos
    await tx.reservationItem.deleteMany({ where: { reservationId: id, isExtra: false } });

    // Crear items reales nuevos
    await tx.reservationItem.createMany({
      data: lineCreates.map(l => ({
        reservationId: id,
        serviceId: l.serviceId,
        optionId: l.optionId,
        servicePriceId: l.servicePriceId,
        quantity: l.quantity,
        pax: l.pax,
        unitPriceCents: l.unitPriceCents,
        totalPriceCents: l.totalPriceCents,
        isExtra: false,
      })),
    });

    // Totales
    const serviceSubtotal = lineCreates.reduce((s, l) => s + l.totalPriceCents, 0);

    // Los extras no se tocan, pero sí cuentan en el total vendible
    const extrasSum = await tx.reservationItem.aggregate({
      where: { reservationId: id, isExtra: true },
      _sum: { totalPriceCents: true },
    });
    const extrasTotal = Number(extrasSum._sum.totalPriceCents ?? 0);

    const totalBeforeDiscounts = serviceSubtotal + extrasTotal;

    // Auto-discount por item (recomendado)
    const effectiveChannelId = b.channelId !== undefined ? b.channelId : existing.channelId;
    const channel = effectiveChannelId
      ? await prisma.channel.findUnique({ where: { id: effectiveChannelId }, select: { allowsPromotions: true } })
      : null;
    const promotionsEnabled = channel ? Boolean(channel.allowsPromotions) : true;
    const country = normalizeOptionalString(b.customerCountry) ?? existingPack.customerCountry ?? "ES";

    let autoDiscountCents = 0;
    for (const l of lineCreates) {
      const detail = await computeAutoDiscountDetail({
        when: now,
        item: {
          serviceId: l.serviceId,
          optionId: l.optionId,
          category: l.category,
          isExtra: false,
          lineBaseCents: l.totalPriceCents,
        },
        promoCode: promotionsEnabled ? (l.promoCode ?? null) : null,
        customerCountry: country,
        promotionsEnabled,
      });
      autoDiscountCents += Number(detail.discountCents ?? 0);
    }

    // Manual discount (cap 30% del totalBeforeDiscounts)
    const incomingManual = b.manualDiscountCents !== undefined ? Number(b.manualDiscountCents) : Number(existingPack.manualDiscountCents ?? 0);
    const manualDiscountCents = capManual30(totalBeforeDiscounts, incomingManual);

    const finalTotalCents = Math.max(0, totalBeforeDiscounts - autoDiscountCents - manualDiscountCents);

    // Fianza (jetski units)
    const jetskiUnits = lineCreates.filter(l => l.category === "JETSKI").reduce((s, l) => s + l.quantity, 0);
    const depositPerUnit = b.isLicense ? 50000 : 10000;
    const depositCents = depositPerUnit * jetskiUnits;

    // Compat main: primer item
    const main = lineCreates[0];

    const data: Prisma.ReservationUncheckedUpdateInput = {
      pax: b.pax,
      isLicense: b.isLicense,
      channelId: b.channelId ?? null,
      activityDate,
      scheduledTime,
      depositCents,

      serviceId: main.serviceId,
      optionId: main.optionId,

      basePriceCents: serviceSubtotal,
      autoDiscountCents,
      manualDiscountCents,
      manualDiscountReason: b.manualDiscountReason ?? null,
      promoCode: promotionsEnabled ? (() => {
        const promoCodes = Array.from(new Set(lineCreates.map((line) => line.promoCode).filter(Boolean)));
        return promoCodes.length === 1 ? promoCodes[0] : null;
      })() : null,
      totalPriceCents: finalTotalCents,
    };

    Object.assign(data, buildOptionalData());

    if (!b.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    await tx.reservation.update({ where: { id }, data, select: { id: true } });

    return { id };
  });

  return NextResponse.json({ ok: true, ...result });
}

  const tz = BUSINESS_TZ;
  const activityDate = utcDateFromYmdInTz(tz, b.activityDate);
  const scheduledTime = utcDateTimeFromYmdHmInTz(tz, b.activityDate, b.time ?? null);

  const priceSensitiveChanged =
    existing.serviceId !== b.serviceId ||
    existing.optionId !== b.optionId ||
    Number(existing.quantity) !== Number(b.quantity) ||
    Boolean(existing.isLicense) !== Boolean(b.isLicense);

    const mainCount = await prisma.reservationItem.count({
      where: { reservationId: id, isExtra: false },
    });

    const isMultiOrPack = mainCount > 1 || Boolean(existing.isPackParent);

  // normalizar opcionales (misma semántica)
  const customerPhone = normalizeOptionalString(b.customerPhone);
  const customerEmail = normalizeOptionalString(b.customerEmail);
  const customerCountry = normalizeOptionalString(b.customerCountry);
  const customerAddress = normalizeOptionalString(b.customerAddress);
  const customerPostalCode = normalizeOptionalString(b.customerPostalCode);
  const customerBirthDate = b.customerBirthDate !== undefined ? (b.customerBirthDate ? new Date(b.customerBirthDate) : null) : undefined;
  const customerDocType = normalizeOptionalString(b.customerDocType);
  const customerDocNumber = normalizeOptionalString(b.customerDocNumber);
  const marketing = normalizeOptionalString(b.marketing);

  const licenseSchool = normalizeOptionalString(b.licenseSchool);
  const licenseType = normalizeOptionalString(b.licenseType);
  const licenseNumber = normalizeOptionalString(b.licenseNumber);

  // calcular valores finales (merge): undefined => keep existing
  const finalLicenseSchool = licenseSchool === undefined ? existing.licenseSchool : licenseSchool;
  const finalLicenseType = licenseType === undefined ? existing.licenseType : licenseType;
  const finalLicenseNumber = licenseNumber === undefined ? existing.licenseNumber : licenseNumber;

  // regla de negocio recomendada:
  // - si isLicense=true => deben existir (después del merge)
  // - si isLicense=false => limpiamos (evita datos basura)
  if (b.isLicense) {
    if (!finalLicenseSchool || !finalLicenseType || !finalLicenseNumber) {
      return new NextResponse("Faltan datos de licencia (escuela, tipo y número).", { status: 400 });
    }
  }

  // helper: construir data sin pisar con undefined
  function buildOptionalData() {
    const data: Prisma.ReservationUncheckedUpdateInput = {};

    if (customerPhone !== undefined) data.customerPhone = customerPhone;
    if (customerEmail !== undefined) data.customerEmail = customerEmail;
    if (customerCountry !== undefined) {
      data.customerCountry = customerCountry ? String(customerCountry).toUpperCase() : existing!.customerCountry;
    }
    if (customerAddress !== undefined) data.customerAddress = customerAddress;
    if (customerPostalCode !== undefined) data.customerPostalCode = customerPostalCode;
    if (customerBirthDate !== undefined) data.customerBirthDate = customerBirthDate;
    if (customerDocType !== undefined) data.customerDocType = customerDocType;
    if (customerDocNumber !== undefined) data.customerDocNumber = customerDocNumber;
    if (marketing !== undefined) data.marketing = marketing;

    if (licenseSchool !== undefined) data.licenseSchool = licenseSchool;
    if (licenseType !== undefined) data.licenseType = licenseType;
    if (licenseNumber !== undefined) data.licenseNumber = licenseNumber;

    return data;
  }

  // Si no hay cambio de precio, solo update de campos
  if (!priceSensitiveChanged) {
    const data: Prisma.ReservationUncheckedUpdateInput = {
      pax: b.pax,
      channelId: b.channelId ?? null,
      activityDate,
      scheduledTime,

      // campos fijos
      isLicense: b.isLicense,
      quantity: b.quantity,
    };

    Object.assign(data, buildOptionalData());

    // Si se desmarca licencia, limpiamos siempre
    if (!b.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    await prisma.reservation.update({
      where: { id },
      data,
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id });
  }

  if (priceSensitiveChanged && isMultiOrPack) {
    // Evita convertir una multi-actividad en single
    return new NextResponse(
      "Esta reserva tiene varias actividades (o es un pack). No se puede cambiar servicio/duración/cantidad desde aquí.",
      { status: 400 }
    );
  }

  // --- Recalcular como create-quick ---
  const now = new Date();

  const svc = await prisma.service.findUnique({
    where: { id: b.serviceId },
    select: { id: true, category: true },
  });
  if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

  const opt = await prisma.serviceOption.findUnique({
    where: { id: b.optionId },
    select: { id: true, serviceId: true, durationMinutes: true },
  });
  if (!opt) return new NextResponse("Opción no existe", { status: 400 });
  if (opt.serviceId !== svc.id) return new NextResponse("La opción no pertenece al servicio", { status: 400 });

  let price = await prisma.servicePrice.findFirst({
    where: {
      serviceId: svc.id,
      optionId: opt.id,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { id: true, basePriceCents: true },
  });

  if (!price) {
    price = await prisma.servicePrice.findFirst({
      where: {
        serviceId: svc.id,
        optionId: null,
        durationMin: opt.durationMinutes,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });
  }

  if (!price) return new NextResponse("No hay precio vigente para este servicio/duración.", { status: 400 });

  const unitPriceCents = Number(price.basePriceCents) || 0;
  const principalCents = unitPriceCents * Number(b.quantity);

  const depositPerUnit = b.isLicense ? 50000 : 10000;
  const depositCents = depositPerUnit * Number(b.quantity);

  const result = await prisma.$transaction(async (tx) => {
    const effectiveChannelId = b.channelId !== undefined ? b.channelId : existing.channelId;
    const channel = effectiveChannelId
      ? await tx.channel.findUnique({ where: { id: effectiveChannelId }, select: { allowsPromotions: true } })
      : null;
    const promotionsEnabled = channel ? Boolean(channel.allowsPromotions) : true;
    const data: Prisma.ReservationUncheckedUpdateInput = {
      serviceId: svc.id,
      optionId: opt.id,
      channelId: b.channelId ?? null,
      quantity: b.quantity,
      pax: b.pax,
      isLicense: b.isLicense,

      activityDate,
      scheduledTime,
      depositCents,
    };

    Object.assign(data, buildOptionalData());

    // Si se desmarca licencia, limpiamos siempre
    if (!b.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    await tx.reservation.update({
      where: { id },
      data,
      select: { id: true },
    });

    await tx.reservationItem.deleteMany({
      where: { reservationId: id, isExtra: false },
    });

    await tx.reservationItem.create({
      data: {
        reservationId: id,
        serviceId: svc.id,
        optionId: opt.id,
        servicePriceId: price!.id,
        quantity: b.quantity,
        pax: b.pax,
        unitPriceCents,
        totalPriceCents: principalCents,
        isExtra: false,
      },
    });

    const mainSum = await tx.reservationItem.aggregate({
      where: { reservationId: id, isExtra: false },
      _sum: { totalPriceCents: true },
    });
    const allSum = await tx.reservationItem.aggregate({
      where: { reservationId: id },
      _sum: { totalPriceCents: true },
    });

    const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0);
    const totalBeforeDiscounts = Number(allSum._sum.totalPriceCents ?? 0);

    const detail = await computeAutoDiscountDetail({
      when: new Date(),
      item: {
        serviceId: svc.id,
        optionId: opt.id,
        category: svc.category ?? null,
        isExtra: false,
        lineBaseCents: serviceSubtotal,
      },
      promoCode: null,
      customerCountry: customerCountry === undefined ? existing.customerCountry : customerCountry,
      promotionsEnabled,
    });

    const autoDiscountCents = Number(detail.discountCents ?? 0);
    const manualDiscountCents = Number(existing.manualDiscountCents ?? 0);

    const finalTotalCents = Math.max(0, totalBeforeDiscounts - autoDiscountCents - manualDiscountCents);

    await tx.reservation.update({
      where: { id },
      data: {
        basePriceCents: serviceSubtotal,
        autoDiscountCents,
        totalPriceCents: finalTotalCents,
      },
      select: { id: true },
    });

    return { id };
  });

  return NextResponse.json({ ok: true, ...result });
}

