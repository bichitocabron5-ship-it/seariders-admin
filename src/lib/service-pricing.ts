import { PricingTier, Prisma } from "@prisma/client";

type ServicePriceReader = {
  servicePrice: Prisma.TransactionClient["servicePrice"];
  serviceOption: Prisma.TransactionClient["serviceOption"];
};

type EffectiveServicePriceReader = ServicePriceReader & {
  channelOptionPrice: Prisma.TransactionClient["channelOptionPrice"];
};

type ActiveServicePriceResult = {
  id: string | null;
  basePriceCents: number;
  pricingTier: PricingTier;
};

export type EffectiveChannelServicePriceResult = {
  servicePriceId: string | null;
  adminPriceCents: number;
  effectivePriceCents: number;
  channelPriceApplied: boolean;
  pricingTier: PricingTier;
};

function isMissingChannelOptionPriceTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.modelName ?? "") === "ChannelOptionPrice"
  );
}

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

export async function resolveEffectiveServicePriceForChannel(
  tx: EffectiveServicePriceReader,
  params: {
    serviceId: string;
    optionId: string;
    durationMinutes: number;
    now: Date;
    pricingTier?: PricingTier;
    channelId?: string | null;
  }
): Promise<EffectiveChannelServicePriceResult | null> {
  const adminPrice = await findActiveServicePrice(tx, params);

  if (!adminPrice) return null;

  const adminPriceCents = Number(adminPrice.basePriceCents ?? 0);
  const baseResult: EffectiveChannelServicePriceResult = {
    servicePriceId: adminPrice.id ?? null,
    adminPriceCents,
    effectivePriceCents: adminPriceCents,
    channelPriceApplied: false,
    pricingTier: adminPrice.pricingTier,
  };

  if (!params.channelId) return baseResult;

  const channelOptionPrice = await tx.channelOptionPrice
    .findUnique({
      where: {
        channelId_optionId: {
          channelId: params.channelId,
          optionId: params.optionId,
        },
      },
      select: { priceCents: true, isActive: true },
    })
    .catch((error: unknown) => {
      if (isMissingChannelOptionPriceTable(error)) return null;
      throw error;
    });

  if (!channelOptionPrice?.isActive) return baseResult;

  return {
    ...baseResult,
    effectivePriceCents: Number(channelOptionPrice.priceCents ?? 0),
    channelPriceApplied: true,
  };
}
