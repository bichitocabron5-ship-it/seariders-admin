import { PricingTier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { annotateServiceOptions } from "@/lib/service-option-labels";
import {
  buildServiceAllowedChannelIndex,
  serviceHasAllowedChannelRules,
  type ServiceChannelOrigin,
} from "@/lib/service-channel-availability";

type ServiceLite = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  isExternalActivity: boolean;
  isLicense: boolean;
  isActive: boolean;
  visibleInBooth: boolean;
  hasAllowedChannelRules?: boolean;
};

function normalizeCodePart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

function isExtra(service: Pick<ServiceLite, "category">) {
  return String(service.category ?? "").toUpperCase() === "EXTRA";
}

function isAcompanante(service: Pick<ServiceLite, "code" | "name">) {
  const c = normalize(String(service.code ?? ""));
  const n = normalize(String(service.name ?? ""));
  return c === "acompanante" || n.includes("acompan");
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

export async function buildPosCatalog(origin: ServiceChannelOrigin) {
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
        visibleInBooth: true,
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
        kind: true,
        visibleInStore: true,
        visibleInBooth: true,
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

  let servicesVisible = servicesAll.slice();
  if (origin === "STORE") {
    servicesVisible = servicesVisible.filter((service) => !isAcompanante(service));
  } else {
    servicesVisible = servicesVisible.filter((service) => service.visibleInBooth);
  }

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

  let channels = channelsAll.slice();
  channels = origin === "BOOTH" ? channels.filter((c) => c.visibleInBooth) : channels.filter((c) => c.visibleInStore);
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

  const standardPriceMap = new Map<string, number>();
  const residentPriceMap = new Map<string, number>();
  for (const pr of prices) {
    const targetMap = pr.pricingTier === PricingTier.RESIDENT ? residentPriceMap : standardPriceMap;
    const key = pr.optionId ? `${pr.serviceId}:${pr.optionId}` : `${pr.serviceId}:null`;
    if (!targetMap.has(key)) targetMap.set(key, pr.basePriceCents);
  }

  const visibleMainIds = new Set(servicesMainWithAvailability.map((service) => service.id));
  const options = annotateServiceOptions(
    optionsRaw
      .filter((option) => visibleMainIds.has(option.serviceId))
      .filter((option) => (origin === "BOOTH" ? option.visibleInBooth : option.visibleInStore))
  ).map((option) => {
    const key = `${option.serviceId}:${option.id}`;
    const standardPriceCents = standardPriceMap.get(key) ?? null;
    const residentPriceCents = residentPriceMap.get(key) ?? null;
    const boothFallback = origin === "BOOTH" ? Number(option.basePriceCents ?? 0) || 0 : null;
    const base = standardPriceCents ?? boothFallback;

    return {
      ...option,
      basePriceCents: base,
      standardPriceCents,
      residentPriceCents,
      hasPrice: (base != null && base > 0) || (residentPriceCents != null && residentPriceCents > 0),
    };
  });

  const extraPriceByServiceId: Record<string, number | null> = {};
  for (const service of servicesExtraWithAvailability) {
    extraPriceByServiceId[service.id] = standardPriceMap.get(`${service.id}:null`) ?? null;
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

export async function buildPublicCatalogSnapshot() {
  const storeCatalog = await buildPosCatalog("STORE");

  const optionsByServiceId = new Map<string, Array<(typeof storeCatalog.options)[number]>>();
  for (const option of storeCatalog.options) {
    const current = optionsByServiceId.get(option.serviceId) ?? [];
    current.push(option);
    optionsByServiceId.set(option.serviceId, current);
  }

  const services = storeCatalog.servicesMain.map((service) => {
    const serviceCode = getStableServiceCode(service);
    const options = (optionsByServiceId.get(service.id) ?? [])
      .filter((option) => option.hasPrice)
      .map((option) => ({
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
      }));

    return {
      serviceCode,
      name: service.name,
      category: service.category,
      isExternalActivity: Boolean(service.isExternalActivity),
      isLicense: Boolean(service.isLicense),
      options,
    };
  });

  const extras = storeCatalog.servicesExtra.map((service) => ({
    serviceCode: getStableServiceCode(service),
    name: service.name,
    category: service.category,
    hasStandalonePricing: Number(storeCatalog.extraPriceByServiceId[service.id] ?? 0) > 0,
  }));

  return {
    generatedAt: new Date().toISOString(),
    categories: storeCatalog.categories,
    services,
    extras,
  };
}
