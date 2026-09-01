import { PricingTier, type JetskiLicenseMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeAutoDiscountDetail, listPromotionOptions } from "@/lib/discounts";
import {
  findPublicWebCatalogOptionOrThrow,
  getStableOptionCode,
  getStableServiceCode,
} from "@/lib/public-api/catalog";
import { PublicApiError } from "@/lib/public-api/errors";
import { resolveEffectiveServicePriceForChannel } from "@/lib/service-pricing";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";

function formatModeLabel(pricingTier: PricingTier) {
  return pricingTier === PricingTier.RESIDENT
    ? "Tarifa residente / llave verde"
    : "Tarifa estandar / llave amarilla o sin licencia";
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

  const { option, webChannel } = await findPublicWebCatalogOptionOrThrow(prisma, {
    serviceCode: params.serviceCode,
    optionCode: params.optionCode,
  });

  const when =
    params.date && params.time
      ? (utcDateTimeFromYmdHmInTz(BUSINESS_TZ, params.date, params.time) ?? utcDateFromYmdInTz(BUSINESS_TZ, params.date))
      : params.date
        ? utcDateFromYmdInTz(BUSINESS_TZ, params.date)
        : new Date();

  const pricingTier = PricingTier.STANDARD;

  const price = await resolveEffectiveServicePriceForChannel(prisma, {
    serviceId: option.service.id,
    optionId: option.id,
    durationMinutes: Number(option.durationMinutes ?? 30),
    now: when,
    pricingTier,
    channelId: webChannel.id,
    allowLegacyOptionFallback: false,
    allowChannelOnlyPrice: true,
  });

  if (!price) {
    throw new PublicApiError("NO_PRICE", 404, "No hay precio vigente para esta opcion.");
  }

  const baseUnitPriceCents = Number(price.effectivePriceCents ?? 0);
  const baseTotalCents = baseUnitPriceCents * quantity;
  const item = {
    serviceId: option.service.id,
    optionId: option.id,
    category: option.service.category ?? null,
    isExtra: false,
    lineBaseCents: baseTotalCents,
    quantity,
  };
  const promotionsEnabled = Boolean(webChannel.allowsPromotions);

  const availablePromos = await listPromotionOptions({
    when,
    item,
    customerCountry,
    promotionsEnabled,
  });
  const matchedPromo = promoCode
    ? availablePromos.find((promo) => String(promo.code ?? "").trim().toUpperCase() === promoCode) ?? null
    : null;

  if (promoCode && !matchedPromo) {
    throw new PublicApiError("PROMO_INVALID", 400, "El promoCode no es valido para esta combinacion.");
  }

  const detail = await computeAutoDiscountDetail({
    when,
    item,
    promoCode,
    customerCountry,
    promotionsEnabled,
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
