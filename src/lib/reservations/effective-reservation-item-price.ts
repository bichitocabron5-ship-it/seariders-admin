import { PricingTier } from "@prisma/client";

import { resolveEffectiveServicePriceForChannel } from "@/lib/service-pricing";

type EffectivePriceReader = Parameters<typeof resolveEffectiveServicePriceForChannel>[0];

export type ReservationItemPriceSnapshot = {
  servicePriceId: string | null;
  unitPriceCents: number;
  totalPriceCents: number;
};

export async function resolveEffectiveReservationItemPrice(
  tx: EffectivePriceReader,
  params: {
    serviceId: string;
    optionId: string;
    durationMinutes: number;
    quantity: number;
    now: Date;
    pricingTier?: PricingTier;
    channelId?: string | null;
  }
): Promise<ReservationItemPriceSnapshot | null> {
  const quantity = Math.max(1, Number(params.quantity ?? 1));
  const price = await resolveEffectiveServicePriceForChannel(tx, {
    serviceId: params.serviceId,
    optionId: params.optionId,
    durationMinutes: params.durationMinutes,
    now: params.now,
    pricingTier: params.pricingTier,
    channelId: params.channelId,
  });

  if (!price) return null;

  const unitPriceCents = Number(price.effectivePriceCents ?? 0);
  return {
    servicePriceId: price.servicePriceId,
    unitPriceCents,
    totalPriceCents: unitPriceCents * quantity,
  };
}

export function buildPreservedReservationItemPriceSnapshot(
  item:
    | {
        servicePriceId?: string | null;
        unitPriceCents?: number | null;
        totalPriceCents?: number | null;
      }
    | null
    | undefined
): ReservationItemPriceSnapshot {
  return {
    servicePriceId: item?.servicePriceId ?? null,
    unitPriceCents: Number(item?.unitPriceCents ?? 0),
    totalPriceCents: Number(item?.totalPriceCents ?? 0),
  };
}
