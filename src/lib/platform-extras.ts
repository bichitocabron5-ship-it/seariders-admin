import type { Prisma, Service } from "@prisma/client";

export type PlatformExtraTarget = "JETSKI" | "BOAT";

export type PlatformCatalogExtra = {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  extraMinutes: number;
  target: PlatformExtraTarget;
  unitPriceCents: number | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function inferTarget(service: Pick<Service, "code" | "name">): PlatformExtraTarget | null {
  const code = normalizeText(service.code);
  const name = normalizeText(service.name);
  const haystack = `${code} ${name}`;

  if (!haystack.trim()) return null;
  if (haystack.includes("jetski") || haystack.includes("moto")) return "JETSKI";
  if (haystack.includes("boat") || haystack.includes("barco") || haystack.includes("nautica")) return "BOAT";
  return null;
}

function inferMinutes(service: Pick<Service, "code" | "name">): number | null {
  const code = normalizeText(service.code);
  const name = normalizeText(service.name);
  const haystack = `${code} ${name}`;

  const directPatterns: Array<[RegExp, number]> = [
    [/(^|[^0-9])20([^0-9]|$)/, 20],
    [/(^|[^0-9])40([^0-9]|$)/, 40],
    [/(^|[^0-9])60([^0-9]|$)/, 60],
    [/(^|[^0-9])120([^0-9]|$)/, 120],
  ];

  for (const [pattern, minutes] of directPatterns) {
    if (pattern.test(haystack)) return minutes;
  }

  if (haystack.includes("+20")) return 20;
  if (haystack.includes("+40")) return 40;
  if (haystack.includes("+60")) return 60;
  if (haystack.includes("+120")) return 120;

  return null;
}

export function parsePlatformExtraService(service: Pick<Service, "id" | "code" | "name">): Omit<PlatformCatalogExtra, "unitPriceCents"> | null {
  const target = inferTarget(service);
  const extraMinutes = inferMinutes(service);
  if (!target || !extraMinutes) return null;

  return {
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: service.name,
    extraMinutes,
    target,
  };
}

export async function listPlatformCatalogExtrasTx(
  tx: Prisma.TransactionClient,
  target?: PlatformExtraTarget
): Promise<PlatformCatalogExtra[]> {
  const now = new Date();
  const services = await tx.service.findMany({
    where: {
      isActive: true,
      category: "EXTRA",
    },
    select: {
      id: true,
      code: true,
      name: true,
      servicePrices: {
        where: {
          optionId: null,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: { validFrom: "desc" },
        select: {
          basePriceCents: true,
        },
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return services
    .map((service) => {
      const parsed = parsePlatformExtraService(service);
      if (!parsed) return null;
      return {
        ...parsed,
        unitPriceCents:
          service.servicePrices.length > 0
            ? Number(service.servicePrices[0].basePriceCents ?? 0)
            : null,
      };
    })
    .filter((item): item is PlatformCatalogExtra => Boolean(item))
    .filter((item) => (target ? item.target === target : true))
    .sort((a, b) => a.extraMinutes - b.extraMinutes || a.serviceName.localeCompare(b.serviceName, "es"));
}

export async function getPlatformExtraByServiceCodeTx(
  tx: Prisma.TransactionClient,
  serviceCode: string
): Promise<PlatformCatalogExtra | null> {
  const service = await tx.service.findUnique({
    where: { code: serviceCode },
    select: {
      id: true,
      code: true,
      name: true,
      servicePrices: {
        where: {
          optionId: null,
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
        },
        orderBy: { validFrom: "desc" },
        select: { basePriceCents: true },
        take: 1,
      },
    },
  });

  if (!service) return null;

  const parsed = parsePlatformExtraService(service);
  if (!parsed) return null;

  return {
    ...parsed,
    unitPriceCents:
      service.servicePrices.length > 0
        ? Number(service.servicePrices[0].basePriceCents ?? 0)
        : null,
  };
}
