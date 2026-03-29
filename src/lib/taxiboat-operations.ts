import { prisma } from "@/lib/prisma";

export const TAXIBOAT_BOATS = ["TAXIBOAT_1", "TAXIBOAT_2"] as const;

export type TaxiboatBoatCode = (typeof TAXIBOAT_BOATS)[number];

export async function ensureTaxiboatOperations() {
  await Promise.all(
    TAXIBOAT_BOATS.map((boat) =>
      prisma.taxiboatOperation.upsert({
        where: { boat },
        update: {},
        create: {
          boat,
          status: "AT_PLATFORM",
          arrivedPlatformAt: new Date(),
        },
      })
    )
  );
}

export function isTaxiboatBoatCode(value: string): value is TaxiboatBoatCode {
  return TAXIBOAT_BOATS.includes(value as TaxiboatBoatCode);
}
