import { PricingTier, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildActiveCatalogPriceIndex,
  buildActiveChannelOptionPriceIndex,
  resolveCatalogOptionPriceCents,
  resolvePublicOptionPriceCents,
  resolvePublicServicePriceCents,
  resolvePublicWebOptionPriceCents,
  type ActiveCatalogPrice,
  type ActiveChannelOptionPrice,
} from "@/lib/public-api/catalog-pricing";
import { PublicApiError } from "@/lib/public-api/errors";
import type { CommercialValueMode, DiscountResponsibility } from "@/lib/commission";
import { annotateServiceOptions } from "@/lib/service-option-labels";
import {
  buildServiceAllowedChannelIndex,
  isChannelAllowedForService,
  serviceHasAllowedChannelRules,
  type ServiceAllowedChannelRuleLite,
  type ServiceChannelOrigin,
} from "@/lib/service-channel-availability";

export const WEB_CHANNEL_CODE = "WEB";
export type PosCatalogOrigin = Exclude<ServiceChannelOrigin, "WEB">;

type ServiceLite = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  isExternalActivity: boolean;
  isLicense: boolean;
  isActive: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  visibleInWeb: boolean;
  hasAllowedChannelRules?: boolean;
};

type OptionLite = {
  id: string;
  serviceId: string;
  code: string | null;
  durationMinutes: number | null;
  paxMax: number | null;
  contractedMinutes: number | null;
  basePriceCents: number | null;
  isActive: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  visibleInWeb: boolean;
};

type WebChannelLite = {
  id: string;
  code: string | null;
  isActive: boolean;
  visibleInWeb: boolean;
  allowsPromotions?: boolean;
  customerDiscountMode?: CommercialValueMode | null;
  customerDiscountValue?: number | null;
  customerDiscountCents?: number | null;
  discountResponsibility?: DiscountResponsibility | null;
  promoterDiscountShareBps?: number | null;
};

type PublicWebCatalogDb = Pick<Prisma.TransactionClient, "channel" | "serviceOption" | "serviceAllowedChannel">;

function normalizeCodePart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function isExtra(service: Pick<ServiceLite, "category">) {
  return String(service.category ?? "").toUpperCase() === "EXTRA";
}

export function isServiceVisibleForCatalogOrigin(
  origin: ServiceChannelOrigin,
  service: Pick<ServiceLite, "visibleInStore" | "visibleInBooth" | "visibleInWeb">
) {
  if (origin === "BOOTH") return service.visibleInBooth;
  if (origin === "WEB") return service.visibleInWeb;
  return service.visibleInStore;
}

export function isOptionVisibleForCatalogOrigin(
  origin: ServiceChannelOrigin,
  option: Pick<OptionLite, "visibleInStore" | "visibleInBooth" | "visibleInWeb">
) {
  if (origin === "BOOTH") return option.visibleInBooth;
  if (origin === "WEB") return option.visibleInWeb;
  return option.visibleInStore;
}

export function assertPublicWebChannelReady(channel: WebChannelLite | null | undefined): asserts channel is WebChannelLite {
  if (!channel || channel.code !== WEB_CHANNEL_CODE || !channel.isActive || !channel.visibleInWeb) {
    throw new PublicApiError("CONFIGURATION_REQUIRED", 500, "Canal WEB no configurado.");
  }
}

export function getStableServiceCode(service: { code: string | null; name: string; category?: string | null }) {
  return normalizeCodePart(service.code || service.name || service.category || "SERVICE");
}

export function getStableOptionCode(option: {
  code: string | null;
  durationMinutes: number | null;
  paxMax: number | null;
  serviceCode: string;
}) {
  if (option.code) return normalizeCodePart(option.code);
  return normalizeCodePart(`${option.serviceCode}_${option.durationMinutes ?? 0}_${option.paxMax ?? 0}`);
}

export async function getPublicWebChannelOrThrow(tx: PublicWebCatalogDb = prisma) {
  const channel = await tx.channel.findUnique({
    where: { code: WEB_CHANNEL_CODE },
    select: {
      id: true,
      code: true,
      isActive: true,
      visibleInWeb: true,
      allowsPromotions: true,
      customerDiscountMode: true,
      customerDiscountValue: true,
      customerDiscountCents: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
    },
  });

  assertPublicWebChannelReady(channel);
  return channel;
}

export async function findPublicWebCatalogOptionOrThrow(
  tx: PublicWebCatalogDb,
  params: { serviceCode: string; optionCode: string }
) {
  const webChannel = await getPublicWebChannelOrThrow(tx);
  const option = await tx.serviceOption.findFirst({
    where: {
      code: params.optionCode,
      isActive: true,
      visibleInWeb: true,
      service: {
        code: params.serviceCode,
        isActive: true,
        visibleInWeb: true,
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
    throw new PublicApiError("INVALID_INPUT", 400, "serviceCode u optionCode no validos para WEB.");
  }

  const serviceAllowedChannelRules = await tx.serviceAllowedChannel.findMany({
    where: { serviceId: option.service.id },
    select: {
      serviceId: true,
      channelId: true,
      active: true,
    },
  });
  const allowedChannelIndex = buildServiceAllowedChannelIndex(serviceAllowedChannelRules);
  const allowedForWebChannel = isChannelAllowedForService({
    index: allowedChannelIndex,
    serviceId: option.service.id,
    channelId: webChannel.id,
  });

  if (!allowedForWebChannel) {
    throw new PublicApiError("INVALID_INPUT", 400, "serviceCode u optionCode no validos para WEB.");
  }

  return { option, webChannel };
}

export async function buildPosCatalog(origin: PosCatalogOrigin) {
  const now = new Date();

  const [servicesAll, optionsRaw, prices, channelsAll, serviceAllowedChannelRules] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        isExternalActivity: true,
        isLicense: true,
        isActive: true,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),

    prisma.serviceOption.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serviceId: true,
        code: true,
        durationMinutes: true,
        paxMax: true,
        contractedMinutes: true,
        basePriceCents: true,
        isActive: true,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }],
    }),

    prisma.servicePrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: {
        serviceId: true,
        optionId: true,
        durationMin: true,
        pricingTier: true,
        basePriceCents: true,
        validFrom: true,
      },
      orderBy: { validFrom: "desc" },
    }),

    prisma.channel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        kind: true,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
        allowsPromotions: true,
        commissionEnabled: true,
        commissionBps: true,
        customerDiscountMode: true,
        customerDiscountValue: true,
        customerDiscountCents: true,
        promoterCommissionMode: true,
        promoterCommissionValue: true,
        promoterCommissionCents: true,
        discountResponsibility: true,
        promoterDiscountShareBps: true,
        commissionRules: {
          where: { isActive: true },
          select: {
            serviceId: true,
            commissionPct: true,
            promoterCommissionMode: true,
            promoterCommissionValue: true,
            promoterCommissionCents: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),

    prisma.serviceAllowedChannel.findMany({
      select: {
        serviceId: true,
        channelId: true,
        active: true,
      },
    }),
  ]);

  const allowedChannelIndex = buildServiceAllowedChannelIndex(serviceAllowedChannelRules);
  const servicesVisible = servicesAll.filter((service) => isServiceVisibleForCatalogOrigin(origin, service));

  const servicesMain = servicesVisible.filter((service) => !isExtra(service));
  const servicesExtra = servicesVisible.filter((service) => isExtra(service));
  const servicesMainWithAvailability = servicesMain.map((service) => ({
    ...service,
    hasAllowedChannelRules: serviceHasAllowedChannelRules(allowedChannelIndex, service.id),
  }));
  const servicesExtraWithAvailability = servicesExtra.map((service) => ({
    ...service,
    hasAllowedChannelRules: serviceHasAllowedChannelRules(allowedChannelIndex, service.id),
  }));

  const channels =
    origin === "BOOTH" ? channelsAll.filter((c) => c.visibleInBooth) : channelsAll.filter((c) => c.visibleInStore);
  const channelsWithAvailability = channels.map((channel) => ({
    ...channel,
    allowedServiceIds: servicesVisible
      .filter(
        (service) =>
          serviceHasAllowedChannelRules(allowedChannelIndex, service.id) &&
          (allowedChannelIndex.activeChannelIdsByServiceId.get(service.id)?.has(channel.id) ?? false)
      )
      .map((service) => service.id),
  }));

  const priceIndex = buildActiveCatalogPriceIndex(prices);

  const visibleMainIds = new Set(servicesMainWithAvailability.map((service) => service.id));
  const options = annotateServiceOptions(
    optionsRaw
      .filter((option) => visibleMainIds.has(option.serviceId))
      .filter((option) => isOptionVisibleForCatalogOrigin(origin, option))
  ).map((option) => {
    const standardPriceCents = resolvePublicOptionPriceCents(priceIndex, option);
    const residentPriceCents = resolveCatalogOptionPriceCents(priceIndex, option, PricingTier.RESIDENT);
    const boothFallback = origin === "BOOTH" ? Number(option.basePriceCents ?? 0) || 0 : null;
    const base = standardPriceCents ?? boothFallback;

    return {
      ...option,
      basePriceCents: base,
      standardPriceCents,
      publicPriceCents: standardPriceCents,
      residentPriceCents,
      hasPrice: (base != null && base > 0) || (residentPriceCents != null && residentPriceCents > 0),
    };
  });

  const extraPriceByServiceId: Record<string, number | null> = {};
  for (const service of servicesExtraWithAvailability) {
    extraPriceByServiceId[service.id] = resolvePublicServicePriceCents(priceIndex, service.id);
  }

  const categoriesMain = uniqSorted(
    servicesMainWithAvailability.map((service) => String(service.category ?? "")).filter(Boolean)
  );
  const categoriesExtra = uniqSorted(
    servicesExtraWithAvailability.map((service) => String(service.category ?? "")).filter(Boolean)
  );

  return {
    origin,
    servicesMain: servicesMainWithAvailability,
    servicesExtra: servicesExtraWithAvailability,
    categories: { main: categoriesMain, extra: categoriesExtra },
    options,
    extraPriceByServiceId,
    channels: channelsWithAvailability,
    services: servicesMainWithAvailability,
  };
}

export function buildPublicCatalogSnapshotFromRows(args: {
  generatedAt?: string;
  webChannel: WebChannelLite | null | undefined;
  servicesAll: ServiceLite[];
  optionsRaw: OptionLite[];
  prices: ActiveCatalogPrice[];
  webOptionPrices: ActiveChannelOptionPrice[];
  serviceAllowedChannelRules: ServiceAllowedChannelRuleLite[];
}) {
  const webChannel = args.webChannel;
  assertPublicWebChannelReady(webChannel);

  const allowedChannelIndex = buildServiceAllowedChannelIndex(args.serviceAllowedChannelRules);
  const servicesVisible = args.servicesAll.filter(
    (service) =>
      isServiceVisibleForCatalogOrigin("WEB", service) &&
      isChannelAllowedForService({
        index: allowedChannelIndex,
        serviceId: service.id,
        channelId: webChannel.id,
      })
  );

  const servicesMain = servicesVisible.filter((service) => !isExtra(service));
  const servicesExtra = servicesVisible.filter((service) => isExtra(service));
  const visibleMainIds = new Set(servicesMain.map((service) => service.id));
  const priceIndex = buildActiveCatalogPriceIndex(args.prices);
  const webOptionPriceByOptionId = buildActiveChannelOptionPriceIndex(args.webOptionPrices);

  const optionsByServiceId = new Map<
    string,
    Array<
      OptionLite & {
        displayLabel: string;
        secondaryLabel: string | null;
        publicPriceCents: number | null;
        hasPrice: boolean;
      }
    >
  >();

  const options = annotateServiceOptions(
    args.optionsRaw
      .filter((option) => visibleMainIds.has(option.serviceId))
      .filter((option) => isOptionVisibleForCatalogOrigin("WEB", option))
  ).map((option) => {
    const publicPriceCents = resolvePublicWebOptionPriceCents(priceIndex, webOptionPriceByOptionId, option);
    return {
      ...option,
      publicPriceCents,
      hasPrice: publicPriceCents != null && publicPriceCents > 0,
    };
  });

  for (const option of options) {
    if (!option.hasPrice) continue;
    const current = optionsByServiceId.get(option.serviceId) ?? [];
    current.push(option);
    optionsByServiceId.set(option.serviceId, current);
  }

  const services = servicesMain.map((service) => {
    const serviceCode = getStableServiceCode(service);
    const serviceOptions = (optionsByServiceId.get(service.id) ?? []).map((option) => ({
      optionCode: getStableOptionCode({
        code: option.code ?? null,
        durationMinutes: option.durationMinutes ?? null,
        paxMax: option.paxMax ?? null,
        serviceCode,
      }),
      durationMinutes: Number(option.durationMinutes ?? 0),
      contractedMinutes: Number(option.contractedMinutes ?? option.durationMinutes ?? 0),
      paxMax: Number(option.paxMax ?? 0),
      displayLabel: option.displayLabel,
      secondaryLabel: option.secondaryLabel,
      publicPriceCents: option.publicPriceCents,
    }));
    const publicOptionPrices = serviceOptions
      .map((option) => option.publicPriceCents)
      .filter((priceCents): priceCents is number => priceCents != null);

    return {
      serviceCode,
      name: service.name,
      category: service.category,
      isExternalActivity: Boolean(service.isExternalActivity),
      isLicense: Boolean(service.isLicense),
      startingPriceCents: publicOptionPrices.length > 0 ? Math.min(...publicOptionPrices) : null,
      options: serviceOptions,
    };
  });

  const extras = servicesExtra.map((service) => ({
    serviceCode: getStableServiceCode(service),
    name: service.name,
    category: service.category,
    hasStandalonePricing: Number(resolvePublicServicePriceCents(priceIndex, service.id) ?? 0) > 0,
  }));

  return {
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    categories: {
      main: uniqSorted(servicesMain.map((service) => String(service.category ?? "")).filter(Boolean)),
      extra: uniqSorted(servicesExtra.map((service) => String(service.category ?? "")).filter(Boolean)),
    },
    services,
    extras,
  };
}

export async function buildPublicCatalogSnapshot() {
  const now = new Date();
  const webChannel = await getPublicWebChannelOrThrow(prisma);

  const [servicesAll, optionsRaw, prices, webOptionPrices, serviceAllowedChannelRules] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        isExternalActivity: true,
        isLicense: true,
        isActive: true,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),

    prisma.serviceOption.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serviceId: true,
        code: true,
        durationMinutes: true,
        paxMax: true,
        contractedMinutes: true,
        basePriceCents: true,
        isActive: true,
        visibleInStore: true,
        visibleInBooth: true,
        visibleInWeb: true,
      },
      orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }],
    }),

    prisma.servicePrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: {
        serviceId: true,
        optionId: true,
        durationMin: true,
        pricingTier: true,
        basePriceCents: true,
        validFrom: true,
      },
      orderBy: { validFrom: "desc" },
    }),

    prisma.channelOptionPrice.findMany({
      where: {
        channelId: webChannel.id,
        isActive: true,
      },
      select: {
        optionId: true,
        priceCents: true,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    }),

    prisma.serviceAllowedChannel.findMany({
      select: {
        serviceId: true,
        channelId: true,
        active: true,
      },
    }),
  ]);

  return buildPublicCatalogSnapshotFromRows({
    webChannel,
    servicesAll,
    optionsRaw,
    prices,
    webOptionPrices,
    serviceAllowedChannelRules,
  });
}
