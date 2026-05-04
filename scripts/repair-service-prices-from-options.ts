import "dotenv/config";
import { PricingTier } from "@prisma/client";
import { prisma, pgPool } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const options = await prisma.serviceOption.findMany({
    where: {
      isActive: true,
      basePriceCents: { gt: 0 },
      service: {
        isActive: true,
        category: { not: "JETSKI" },
      },
    },
    select: {
      id: true,
      code: true,
      serviceId: true,
      durationMinutes: true,
      basePriceCents: true,
      service: {
        select: {
          name: true,
          category: true,
        },
      },
    },
    orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }],
  });

  let created = 0;
  let skipped = 0;

  for (const option of options) {
    const existing = await prisma.servicePrice.findFirst({
      where: {
        serviceId: option.serviceId,
        optionId: option.id,
        pricingTier: PricingTier.STANDARD,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.servicePrice.create({
      data: {
        serviceId: option.serviceId,
        optionId: option.id,
        pricingTier: PricingTier.STANDARD,
        basePriceCents: Number(option.basePriceCents ?? 0),
        validFrom: now,
        isActive: true,
      },
    });

    created += 1;
    console.log(
      `Created STANDARD price for ${option.service.name} / ${option.code} (${option.durationMinutes} min): ${option.basePriceCents} cents`
    );
  }

  console.log(`Repair finished. Created: ${created}. Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pgPool.end();
  });
