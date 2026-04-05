// src/lib/reservations/createReservationWithItems.ts
import type { Prisma } from "@prisma/client";
import { computeAutoDiscountDetail } from "@/lib/discounts";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz, shouldAutoFormalize, todayYmdInTz } from "@/lib/tz-business";
import { assertSlotCapacityOrThrow } from "@/lib/slot-capacity";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";

type CreateItemInput = {
  serviceIdOrCode: string;
  optionIdOrCode: string;
  quantity: number;
  pax: number;
  promoCode?: string | null;
};

type CreateReservationInput = {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCountry?: string | null;
  customerAddress?: string | null;
  customerPostalCode?: string | null;
  customerBirthDate?: string | null;
  customerDocType?: string | null;
  customerDocNumber?: string | null;
  marketing?: string | null;
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  channelId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (obligatorio)
  pax: number;
  companionsCount?: number;
  isLicense: boolean;

  manualDiscountCents?: number;
  manualDiscountReason?: string | null;

  // items reales (actividades)
  items: CreateItemInput[];

  // metadata opcional de pack
  packId?: string | null;
  packQty?: number | null; // 👈 NUEVO (cantidad de packs)

  // modo de pricing
  pricing:
  | { mode: "QUICK_SINGLE_ITEM" }
  | { mode: "PACK_FIXED_TOTAL"; totalBeforeDiscountsCents: number }
  | { mode: "CART_MULTI_ITEM" }; // ✅ NUEVO
};

export async function createReservationWithItems(params: {
  tx: Prisma.TransactionClient;
  sessionUserId: string;
  input: CreateReservationInput;
}) {
  const { tx, sessionUserId, input } = params;
  const customerCountry = String(input.customerCountry ?? "").trim().toUpperCase() || "ES";
  const customerPhone = String(input.customerPhone ?? "").trim() || null;
  const customerEmail = String(input.customerEmail ?? "").trim() || null;
  const customerAddress = String(input.customerAddress ?? "").trim() || null;
  const customerPostalCode = String(input.customerPostalCode ?? "").trim() || null;
  const customerBirthDate = input.customerBirthDate ? new Date(input.customerBirthDate) : null;
  const customerDocType = String(input.customerDocType ?? "").trim() || null;
  const customerDocNumber = String(input.customerDocNumber ?? "").trim() || null;
  const marketing = String(input.marketing ?? "").trim() || null;
  const licenseSchool = String(input.licenseSchool ?? "").trim() || null;
  const licenseType = String(input.licenseType ?? "").trim() || null;
  const licenseNumber = String(input.licenseNumber ?? "").trim() || null;

  if (!input.items?.length) throw new Error("items requerido");
  if (!input.time || input.time.length !== 5) throw new Error("time requerido (HH:mm)");

  const tz = BUSINESS_TZ;

  const shouldFormalize = shouldAutoFormalize({
    date: input.date,
    time: input.time,
    tz,
    marginMinutes: 5,
  });
  const isTodayBusiness = input.date === todayYmdInTz(tz);

  const formalizeData = shouldFormalize
    ? { formalizedAt: new Date(), formalizedByUserId: sessionUserId }
    : { formalizedAt: null, formalizedByUserId: null };

  // Fechas
  const activityDate = utcDateFromYmdInTz(tz, input.date);
  const scheduledTime = utcDateTimeFromYmdHmInTz(tz, input.date, input.time);
  if (!scheduledTime) throw new Error("scheduledTime inválido");

  const dayEndExclusiveUtc = utcDateFromYmdInTz(tz, input.date);
  dayEndExclusiveUtc.setUTCDate(dayEndExclusiveUtc.getUTCDate() + 1);

  // Canal
  const ch = await tx.channel.findUnique({ where: { id: input.channelId }, select: { id: true, allowsPromotions: true } });
  if (!ch) throw new Error("Canal no existe");
  const promotionsEnabled = Boolean(ch.allowsPromotions);

  const packQty = Math.max(1, Number(input.packQty ?? 1));

  // Si viene packId, el servidor decide la composición real
  let packMeta: { id: string; code: string; serviceId: string; packOptionId: string } | null = null;

  if (input.packId) {
    const pack = await tx.pack.findUnique({
      where: { id: input.packId },
      select: {
        id: true,
        code: true,
        isActive: true,
        serviceId: true,
        packOptionId: true,
        items: { select: { serviceId: true, optionId: true, quantity: true } },
      },
    });

    if (!pack || !pack.isActive) throw new Error("Pack no existe o está inactivo");
    if (!pack.serviceId || !pack.packOptionId) throw new Error("Pack sin serviceId/packOptionId (Admin Packs)");

    packMeta = { id: pack.id, code: pack.code, serviceId: pack.serviceId, packOptionId: pack.packOptionId };

    // ✅ sustituimos input.items por los items reales del pack (server-truth)
    input.items = pack.items.map((pi) => ({
      serviceIdOrCode: pi.serviceId,
      optionIdOrCode: pi.optionId ?? "", // OJO: si permites optionId null, aquí deberías resolver default option
      quantity: Math.max(1, Number(pi.quantity ?? 1)) * packQty,
      pax: Math.max(1, Number(input.pax ?? 1)),
    }));
  }
  
  // Resolver services/options de todos los items
  // 1) resolver services
  const serviceKeys = Array.from(new Set(input.items.map(i => i.serviceIdOrCode)));
  const serviceOr: Prisma.ServiceWhereInput[] = [];
  for (const k of serviceKeys) serviceOr.push({ id: k }, { code: k });
  const services = await tx.service.findMany({
    where: { OR: serviceOr },
    select: { id: true, code: true, category: true },
  });

  const svcByKey = new Map<string, { id: string; category: string | null }>();
  for (const k of serviceKeys) {
    const s = services.find(x => x.id === k || x.code === k);
    if (s) svcByKey.set(k, { id: s.id, category: s.category ?? null });
  }

  // 2) resolver options
  const optionKeys = Array.from(new Set(input.items.map(i => i.optionIdOrCode)));
  const optionOr: Prisma.ServiceOptionWhereInput[] = [];
  for (const k of optionKeys) optionOr.push({ id: k }, { code: k });
  const options = await tx.serviceOption.findMany({
    where: { OR: optionOr },
    select: { id: true, code: true, serviceId: true, durationMinutes: true },
  });

  const optByKey = new Map<string, { id: string; serviceId: string; durationMinutes: number }>();
  for (const k of optionKeys) {
    const o = options.find(x => x.id === k || x.code === k);
    if (o) optByKey.set(k, { id: o.id, serviceId: o.serviceId, durationMinutes: Number(o.durationMinutes ?? 30) });
  }

  // Normalizar items ya resueltos
  const resolvedItems = input.items.map((it) => {
    const svc = svcByKey.get(it.serviceIdOrCode);
    if (!svc) throw new Error(`Servicio no existe: ${it.serviceIdOrCode}`);

    const opt = optByKey.get(it.optionIdOrCode);
    if (!opt) throw new Error(`Opción no existe: ${it.optionIdOrCode}`);
    if (opt.serviceId !== svc.id) throw new Error("La opción no pertenece al servicio");

    return {
      serviceId: svc.id,
      optionId: opt.id,
      category: String(svc.category ?? "UNKNOWN").toUpperCase(),
      durationMinutes: opt.durationMinutes,
      quantity: Math.max(1, Number(it.quantity ?? 1)),
      pax: Math.max(1, Number(it.pax ?? input.pax)),
      promoCode: String(it.promoCode ?? "").trim().toUpperCase() || null,
    };
  });

  // ✅ Validación slots por item (capacidad real)
  for (const it of resolvedItems) {
    await assertSlotCapacityOrThrow({
      tx,
      dateStartUtc: activityDate,
      dateEndExclusiveUtc: dayEndExclusiveUtc,
      scheduledStartUtc: scheduledTime,
      category: it.category,
      durationMinutes: it.durationMinutes,
      units: it.quantity,
    });
  }

  // Pricing
  const now = new Date();

  let basePriceCents = 0;
  let autoDiscountCents = 0;
  let manualDiscountCents = Math.max(0, Number(input.manualDiscountCents ?? 0));
  let totalBeforeDiscounts = 0;

  // Depósito (misma lógica actual: jetski units)

  function computeDepositCents(params: {
    isLicense: boolean;
    resolvedItems: Array<{ category: string; quantity: number }>;
  }) {
    const { isLicense, resolvedItems } = params;

    const byCat = new Map<string, number>();
    for (const it of resolvedItems) {
      const cat = String(it.category ?? "UNKNOWN").toUpperCase();
      byCat.set(cat, (byCat.get(cat) ?? 0) + Number(it.quantity ?? 1));
    }

    const jetskiUnits = byCat.get("JETSKI") ?? 0;

    // tu regla actual
    const depositPerJetCents = isLicense ? 50000 : 10000;

    return depositPerJetCents * jetskiUnits;
}

  // Crear reservationItems con precios (según modo)
    type ItemCreate = {
    serviceId: string;
    optionId: string;
    quantity: number;
    pax: number;
    promoCode: string | null;
    servicePriceId: string | null;
    unitPriceCents: number;
    totalPriceCents: number;
    isPackParent?: boolean; // 👈 NUEVO
  };

  const itemCreates: ItemCreate[] = [];

  if (input.pricing.mode === "QUICK_SINGLE_ITEM") {
    // Igual que create-quick: precio por servicePrice vigente
    if (resolvedItems.length !== 1) throw new Error("QUICK_SINGLE_ITEM requiere 1 item");

    const it = resolvedItems[0];

    let price = await tx.servicePrice.findFirst({
      where: {
        serviceId: it.serviceId,
        optionId: it.optionId,
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
          serviceId: it.serviceId,
          optionId: null,
          durationMin: it.durationMinutes,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: "desc" },
        select: { id: true, basePriceCents: true },
      });
    }

    if (!price) throw new Error("Este servicio/opción no tiene precio vigente (Admin > Precios).");

    const unitPriceCents = Number(price.basePriceCents) || 0;
    const lineTotal = unitPriceCents * it.quantity;

    basePriceCents = lineTotal;
    totalBeforeDiscounts = lineTotal;

    // Manual cap 30%
    const maxManual = Math.floor((totalBeforeDiscounts * 30) / 100);
    manualDiscountCents = Math.max(0, Math.min(manualDiscountCents, maxManual));

    // Auto descuento (igual que tu quick)
    const detail = await computeAutoDiscountDetail({
      when: now,
      item: {
        serviceId: it.serviceId,
        optionId: it.optionId,
        category: it.category,
        isExtra: false,
        lineBaseCents: basePriceCents,
      },
      promoCode: promotionsEnabled ? (it.promoCode ?? null) : null,
      customerCountry,
      promotionsEnabled,
    });

    autoDiscountCents = Number(detail.discountCents ?? 0);

    itemCreates.push({
      serviceId: it.serviceId,
      optionId: it.optionId,
      quantity: it.quantity,
      pax: it.pax,
      promoCode: it.promoCode ?? null,
      servicePriceId: price.id,
      unitPriceCents,
      totalPriceCents: lineTotal,
    });
    } else if (input.pricing.mode === "CART_MULTI_ITEM" || input.pricing.mode === "PACK_FIXED_TOTAL") {
      // precio real por línea
      totalBeforeDiscounts = 0;
      basePriceCents = 0;
      autoDiscountCents = 0;

      for (const it of resolvedItems) {
        const price = await tx.servicePrice.findFirst({
          where: {
            serviceId: it.serviceId,
            optionId: it.optionId,
            isActive: true,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
          orderBy: { validFrom: "desc" },
          select: { id: true, basePriceCents: true },
        });

        if (!price) throw new Error("Este servicio/opción no tiene precio vigente (Admin > Precios).");

        const unitPriceCents = Number(price.basePriceCents) || 0;
        const lineTotal = unitPriceCents * it.quantity;

        totalBeforeDiscounts += lineTotal;
        basePriceCents += lineTotal;

        // auto descuento por línea (mismo patrón que quick)
        const detail = await computeAutoDiscountDetail({
          when: now,
          item: {
            serviceId: it.serviceId,
            optionId: it.optionId,
            category: it.category,
            isExtra: false,
            lineBaseCents: lineTotal,
          },
          promoCode: promotionsEnabled ? (it.promoCode ?? null) : null,
          customerCountry,
          promotionsEnabled,
        });
        autoDiscountCents += Number(detail.discountCents ?? 0);

        itemCreates.push({
          serviceId: it.serviceId,
          optionId: it.optionId,
          quantity: it.quantity,
          pax: it.pax,
          promoCode: it.promoCode ?? null,
          servicePriceId: price.id,
          unitPriceCents,
          totalPriceCents: lineTotal,
          // si quieres marcar el “main” para UI: isPackParent no aplica aquí
        });
      }

      if (input.pricing.mode === "PACK_FIXED_TOTAL") {
        totalBeforeDiscounts = Math.max(0, Number(input.pricing.totalBeforeDiscountsCents ?? 0));
        basePriceCents = totalBeforeDiscounts;
        autoDiscountCents = 0;
      }

      // manual cap 30% sobre totalBeforeDiscounts (incluye PACK_FIXED_TOTAL)
      const maxManual = Math.floor((Math.max(0, totalBeforeDiscounts) * 30) / 100);
      manualDiscountCents = Math.max(0, Math.min(manualDiscountCents, maxManual));
    }

      const finalTotalCents = Math.max(0, totalBeforeDiscounts - autoDiscountCents - manualDiscountCents);

      const depositCents = computeDepositCents({ isLicense: input.isLicense, resolvedItems });
      
      // Service/option “main” obligatorios en Reservation (por compatibilidad)
      const main = packMeta
        ? { serviceId: packMeta.serviceId, optionId: packMeta.packOptionId }
        : resolvedItems[0];

      const reservationQuantity =
        packMeta
          ? packQty
          : (resolvedItems[0]?.quantity ?? 1);

      const reservation = await tx.reservation.create({
        data: {
          source: "STORE",
          status: "WAITING",
          activityDate,
          scheduledTime,
          storeQueueStartedAt: isTodayBusiness ? new Date() : null,
          ...formalizeData,

          customerName: input.customerName,
          customerPhone,
          customerEmail,
          channelId: ch.id,
          pax: input.pax,
          companionsCount: Number(input.companionsCount ?? 0),
          quantity: reservationQuantity,
          isLicense: input.isLicense,
          isPackParent: Boolean(input.packId),

          // Compat fields (main)
          serviceId: main.serviceId,
          optionId: main.optionId,

          // Totales
          basePriceCents,
          autoDiscountCents,
          manualDiscountCents,
          manualDiscountReason: input.manualDiscountReason ?? null,
          totalPriceCents: finalTotalCents,
          depositCents,

          // placeholders (como ya haces)
          customerCountry,
          customerAddress,
          customerPostalCode,
          customerBirthDate,
          customerDocType,
          customerDocNumber,
          marketing,
          licenseSchool: input.isLicense ? licenseSchool : null,
          licenseType: input.isLicense ? licenseType : null,
          licenseNumber: input.isLicense ? licenseNumber : null,

          // metadata pack (opcional)
          packId: input.packId ?? null,
        },
        select: { id: true },
      });

    for (const it of itemCreates) {
      await tx.reservationItem.create({
        data: {
          reservationId: reservation.id,
          serviceId: it.serviceId,
          optionId: it.optionId,
          servicePriceId: it.servicePriceId,
          quantity: it.quantity,
          pax: it.pax,
          unitPriceCents: it.unitPriceCents,
          totalPriceCents: it.totalPriceCents,
          isExtra: false, // ✅ actividades reales
          isPackParent: Boolean(it.isPackParent), // 👈 NUEVO
        },
      });
    }

    const uniquePromoCodes = Array.from(new Set(itemCreates.map((it) => it.promoCode).filter(Boolean)));
    if (uniquePromoCodes.length <= 1) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { promoCode: uniquePromoCodes[0] ?? null },
        select: { id: true },
      });
    }

    const requiredContractUnits = computeRequiredContractUnits({
      quantity: reservationQuantity,
      isLicense: input.isLicense,
      serviceCategory: resolvedItems[0]?.category ?? null,
      items: resolvedItems.map((it) => ({
        quantity: Number(it.quantity ?? 0),
        isExtra: false,
        service: { category: it.category ?? null },
      })),
    });

    if (shouldFormalize && requiredContractUnits > 0) {
      await tx.reservationContract.createMany({
        data: Array.from({ length: requiredContractUnits }, (_, idx) => ({
          reservationId: reservation.id,
          unitIndex: idx + 1,
        })),
        skipDuplicates: true,
      });
    }

    return {
      id: reservation.id,
      autoFormalized: shouldFormalize,
      requiredContractUnits,
      readyContractUnits: 0,
    };
  }
