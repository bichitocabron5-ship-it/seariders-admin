import { PricingTier, type Prisma } from "@prisma/client";

type ServicePriceReader = {
  servicePrice: Prisma.TransactionClient["servicePrice"];
  serviceOption: Prisma.TransactionClient["serviceOption"];
};

type ActiveServicePriceResult = {
  id: string | null;
  basePriceCents: number;
  pricingTier: PricingTier;
};

export async function findActiveServicePrice(
  tx: ServicePriceReader,
  params: {
    serviceId: string;
    optionId: string;
    durationMinutes: number;
    now: Date;
    pricingTier?: PricingTier;
  }
): Promise<ActiveServicePriceResult | null> {
  const { serviceId, optionId, durationMinutes, now, pricingTier = PricingTier.STANDARD } = params;

  const priceByOption = await tx.servicePrice.findFirst({
    where: {
      serviceId,
      optionId,
      pricingTier,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { id: true, basePriceCents: true, pricingTier: true },
  });

  if (priceByOption) {
    return {
      id: priceByOption.id,
      basePriceCents: Number(priceByOption.basePriceCents ?? 0),
      pricingTier: priceByOption.pricingTier,
    };
  }

  const priceByDuration = await tx.servicePrice.findFirst({
    where: {
      serviceId,
      optionId: null,
      durationMin: durationMinutes,
      pricingTier,
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    orderBy: { validFrom: "desc" },
    select: { id: true, basePriceCents: true, pricingTier: true },
  });

  if (priceByDuration) {
    return {
      id: priceByDuration.id,
      basePriceCents: Number(priceByDuration.basePriceCents ?? 0),
      pricingTier: priceByDuration.pricingTier,
    };
  }

  const legacyOption = await tx.serviceOption.findFirst({
    where: {
      id: optionId,
      serviceId,
      isActive: true,
    },
    select: { basePriceCents: true },
  });

  if (Number(legacyOption?.basePriceCents ?? 0) > 0) {
    return {
      id: null,
      basePriceCents: Number(legacyOption?.basePriceCents ?? 0),
      pricingTier,
    };
  }

  return null;
}
