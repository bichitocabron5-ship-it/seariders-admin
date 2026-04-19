import { PricingTier, type Prisma } from "@prisma/client";

type ServicePriceReader = {
  servicePrice: Prisma.TransactionClient["servicePrice"];
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
) {
  const { serviceId, optionId, durationMinutes, now, pricingTier = PricingTier.STANDARD } = params;

  let price = await tx.servicePrice.findFirst({
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

  if (!price) {
    price = await tx.servicePrice.findFirst({
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
  }

  return price;
}
