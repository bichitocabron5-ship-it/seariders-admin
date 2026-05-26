import { JetskiLicenseMode, PricingTier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { listPromotionOptions, computeAutoDiscountDetail } from "@/lib/discounts";
import { resolvePricingTierForJetskiMode } from "@/lib/jetski-license";
import { getStableOptionCode, getStableServiceCode } from "@/lib/public-api/catalog";
import { PublicApiError } from "@/lib/public-api/http";
import { findActiveServicePrice } from "@/lib/service-pricing";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";

function formatModeLabel(pricingTier: PricingTier) {
  return pricingTier === PricingTier.RESIDENT
    ? "Tarifa residente / llave verde"
    : "Tarifa estándar / llave amarilla o sin licencia";
}

function normalizePromoCode(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

export async function buildPublicQuote(params: {
  serviceCode: string;
  optionCode: string;
  quantity?: number;
  pax?: number;
  date?: string | null;
  time?: string | null;
  jetskiLicenseMode?: JetskiLicenseMode;
  customerCountry?: string | null;
  promoCode?: string | null;
}) {
  const quantity = Math.max(1, Number(params.quantity ?? 1));
  const pax = Math.max(1, Number(params.pax ?? 1));
  const promoCode = normalizePromoCode(params.promoCode);
  const customerCountry = String(params.customerCountry ?? "").trim().toUpperCase() || null;

  const option = await prisma.serviceOption.findFirst({
    where: {
      code: params.optionCode,
      isActive: true,
      service: {
        code: params.serviceCode,
        isActive: true,
      },
    },
    select: {
      id: true,
      code: true,
      durationMinutes: true,
      paxMax: true,
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          isLicense: true,
        },
      },
    },
  });

  if (!option?.service) {
    throw new PublicApiError("INVALID_INPUT", 400, "serviceCode u optionCode no válidos.");
  }

  const when =
    params.date && params.time
      ? (utcDateTimeFromYmdHmInTz(BUSINESS_TZ, params.date, params.time) ?? utcDateFromYmdInTz(BUSINESS_TZ, params.date))
      : params.date
        ? utcDateFromYmdInTz(BUSINESS_TZ, params.date)
        : new Date();

  const category = String(option.service.category ?? "").toUpperCase();
  const pricingTier =
    category === "JETSKI"
      ? resolvePricingTierForJetskiMode(params.jetskiLicenseMode ?? JetskiLicenseMode.NONE)
      : PricingTier.STANDARD;

  const price = await findActiveServicePrice(prisma, {
    serviceId: option.service.id,
    optionId: option.id,
    durationMinutes: Number(option.durationMinutes ?? 30),
    now: when,
    pricingTier,
  });

  if (!price) {
    throw new PublicApiError("NO_PRICE", 404, "No hay precio vigente para esta opción.");
  }

  const baseUnitPriceCents = Number(price.basePriceCents ?? 0);
  const baseTotalCents = baseUnitPriceCents * quantity;
  const item = {
    serviceId: option.service.id,
    optionId: option.id,
    category: option.service.category ?? null,
    isExtra: false,
    lineBaseCents: baseTotalCents,
    quantity,
  };

  const availablePromos = await listPromotionOptions({
    when,
    item,
    customerCountry,
    promotionsEnabled: true,
  });
  const matchedPromo = promoCode
    ? availablePromos.find((promo) => String(promo.code ?? "").trim().toUpperCase() === promoCode) ?? null
    : null;

  if (promoCode && !matchedPromo) {
    throw new PublicApiError("PROMO_INVALID", 400, "El promoCode no es válido para esta combinación.");
  }

  const detail = await computeAutoDiscountDetail({
    when,
    item,
    promoCode,
    customerCountry,
    promotionsEnabled: true,
  });

  const discountCents = Number(detail.discountCents ?? 0);
  const finalTotalCents = Math.max(0, baseTotalCents - discountCents);
  const serviceCode = getStableServiceCode({
    code: option.service.code ?? null,
    name: option.service.name,
    category: option.service.category,
  });
  const optionCode = getStableOptionCode({
    code: option.code ?? null,
    durationMinutes: option.durationMinutes ?? null,
    paxMax: option.paxMax ?? null,
    serviceCode,
  });

  return {
    service: {
      serviceCode,
      name: option.service.name,
      category: option.service.category,
    },
    option: {
      optionCode,
      durationMinutes: Number(option.durationMinutes ?? 0),
      paxMax: Number(option.paxMax ?? 0),
    },
    quantity,
    pax,
    pricingTier,
    baseUnitPriceCents,
    baseTotalCents,
    discountCents,
    finalTotalCents,
    appliedPromotion: detail.rule
      ? {
          code: detail.rule.code,
          name: detail.rule.name,
          kind: detail.rule.kind,
          value: detail.rule.value,
        }
      : null,
    availablePromotions: availablePromos.map((promo) => ({
      code: promo.code,
      name: promo.name,
      kind: promo.kind,
      value: promo.value,
      discountCents: promo.discountCents,
    })),
    pricingMeta: {
      modeLabel: formatModeLabel(pricingTier),
      effectiveAt: when.toISOString(),
    },
  };
}
