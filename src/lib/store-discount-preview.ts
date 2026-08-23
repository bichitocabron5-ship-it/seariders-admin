import { JetskiLicenseMode, PricingTier, type Prisma } from "@prisma/client";

import type {
  DiscountExplain,
  DiscountItem,
  DiscountPromoOption,
} from "@/lib/discounts";
import { resolvePricingTierForJetskiMode } from "@/lib/jetski-license";
import { resolveEffectiveServicePriceForChannel } from "@/lib/service-pricing";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";

export type StoreDiscountPreviewReader = Parameters<typeof resolveEffectiveServicePriceForChannel>[0] & {
  channel: Prisma.TransactionClient["channel"];
  service: Prisma.TransactionClient["service"];
  serviceOption: Prisma.TransactionClient["serviceOption"];
};

export type StoreDiscountPreviewInput = {
  serviceId: string;
  optionId: string;
  channelId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  date?: string | null;
  time?: string | null;
  jetskiLicenseMode?: JetskiLicenseMode | null;
  customerCountry?: string | null;
  promoCode?: string | null;
};

export type StoreDiscountPreviewResult = {
  baseTotalCents: number;
  autoDiscountCents: number;
  finalTotalCents: number;
  pricingTier: PricingTier;
  pricingMeta: {
    pricingTier: PricingTier;
    unitPriceCents: number;
    quantity: number;
    modeLabel: string;
    adminUnitPriceCents: number;
    channelPriceApplied: boolean;
  };
  reason: string | null;
  channelPricingSummary: {
    channelName: string;
    basePriceCents: number;
    referencePriceCents: number;
    adminPriceCents: number;
    effectivePriceCents: number;
    optionLabel: string;
    channelPriceApplied: true;
  } | null;
  availablePromos: Array<{
    code: string | null;
    name: string;
    kind: DiscountPromoOption["kind"];
    value: number;
    discountCents: number;
  }>;
  appliedRule: { id: string; name: string; code: string | null } | null;
};

export type StoreDiscountPreviewDependencies = {
  computeAutoDiscountDetail: (args: {
    when: Date;
    item: DiscountItem;
    promoCode?: string | null;
    customerCountry?: string | null;
    promotionsEnabled?: boolean;
  }) => Promise<DiscountExplain>;
  listPromotionOptions: (args: {
    when: Date;
    item: DiscountItem;
    customerCountry?: string | null;
    promotionsEnabled?: boolean;
  }) => Promise<DiscountPromoOption[]>;
};

export class StoreDiscountPreviewError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StoreDiscountPreviewError";
    this.status = status;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtHM(min: number | null) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function modeLabel(pricingTier: PricingTier) {
  return pricingTier === PricingTier.RESIDENT
    ? "Tarifa residente / llave verde"
    : "Tarifa estándar / llave amarilla o sin licencia";
}

export async function buildStoreDiscountPreview(
  db: StoreDiscountPreviewReader,
  input: StoreDiscountPreviewInput,
  deps: StoreDiscountPreviewDependencies
): Promise<StoreDiscountPreviewResult> {
  const serviceId = input.serviceId;
  const optionId = input.optionId;
  const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1)));
  const pax = Math.max(1, Math.floor(Number(input.pax ?? 1)));

  const opt = await db.serviceOption.findUnique({
    where: { id: optionId },
    select: { id: true, serviceId: true, durationMinutes: true },
  });
  if (!opt) throw new StoreDiscountPreviewError(404, "Opción no existe");
  if (opt.serviceId !== serviceId) {
    throw new StoreDiscountPreviewError(400, "Opción no pertenece al servicio");
  }

  const when =
    input.date && input.time
      ? (utcDateTimeFromYmdHmInTz(BUSINESS_TZ, input.date, input.time) ?? utcDateFromYmdInTz(BUSINESS_TZ, input.date))
      : new Date();

  const [channel, svc] = await Promise.all([
    input.channelId
      ? db.channel.findUnique({
          where: { id: input.channelId },
          select: { id: true, name: true, allowsPromotions: true },
        })
      : null,
    db.service.findUnique({
      where: { id: serviceId },
      select: { category: true, name: true },
    }),
  ]);

  const promotionsEnabled = channel ? Boolean(channel.allowsPromotions) : true;
  const requestedPricingTier =
    String(svc?.category ?? "").toUpperCase() === "JETSKI"
      ? resolvePricingTierForJetskiMode(input.jetskiLicenseMode)
      : PricingTier.STANDARD;

  const price = await resolveEffectiveServicePriceForChannel(db, {
    serviceId,
    optionId,
    durationMinutes: Number(opt.durationMinutes ?? 30),
    now: when,
    pricingTier: requestedPricingTier,
    channelId: channel?.id ?? null,
  });

  if (!price) {
    throw new StoreDiscountPreviewError(400, "No hay precio vigente para esta opción.");
  }

  const effectivePriceCents = Number(price.effectivePriceCents || 0);
  const adminPriceCents = Number(price.adminPriceCents || 0);
  const baseTotalCents = effectivePriceCents * quantity;

  const item: DiscountItem = {
    serviceId,
    optionId,
    category: svc?.category ?? null,
    isExtra: false,
    lineBaseCents: baseTotalCents,
    quantity,
  };

  const detail = await deps.computeAutoDiscountDetail({
    when,
    item,
    promoCode: input.promoCode ?? null,
    customerCountry: input.customerCountry ?? null,
    promotionsEnabled,
  });
  const availablePromos = await deps.listPromotionOptions({
    when,
    item,
    customerCountry: input.customerCountry ?? null,
    promotionsEnabled,
  });

  const autoDiscountCents = Number(detail.discountCents || 0);
  const finalTotalCents = Math.max(0, baseTotalCents - autoDiscountCents);

  const start = fmtHM(detail.rule?.startTimeMin ?? null);
  const end = fmtHM(detail.rule?.endTimeMin ?? null);
  const reason = detail.rule
    ? [
        detail.rule.name,
        detail.rule.code ? `código:${detail.rule.code}` : null,
        detail.rule.requiresCountry ? `req:${detail.rule.requiresCountry}` : null,
        detail.rule.excludeCountry ? `exc:${detail.rule.excludeCountry}` : null,
        start || end ? `${start ?? "-"}-${end ?? "-"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return {
    baseTotalCents,
    autoDiscountCents,
    finalTotalCents,
    pricingTier: price.pricingTier,
    pricingMeta: {
      pricingTier: price.pricingTier,
      unitPriceCents: effectivePriceCents,
      quantity,
      modeLabel: modeLabel(price.pricingTier),
      adminUnitPriceCents: adminPriceCents,
      channelPriceApplied: price.channelPriceApplied,
    },
    reason,
    channelPricingSummary:
      channel && price.channelPriceApplied
        ? {
            channelName: channel.name,
            basePriceCents: adminPriceCents * quantity,
            referencePriceCents: effectivePriceCents * quantity,
            adminPriceCents: adminPriceCents * quantity,
            effectivePriceCents: effectivePriceCents * quantity,
            optionLabel: `${opt.durationMinutes} min · ${pax} pax`,
            channelPriceApplied: true,
          }
        : null,
    availablePromos: availablePromos.map((promo) => ({
      code: promo.code,
      name: promo.name,
      kind: promo.kind,
      value: promo.value,
      discountCents: promo.discountCents,
    })),
    appliedRule: detail.rule
      ? { id: detail.rule.id, name: detail.rule.name, code: detail.rule.code ?? null }
      : null,
  };
}
