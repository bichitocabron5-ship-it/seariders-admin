import type { Prisma } from "@prisma/client";

export type ServiceChannelOrigin = "STORE" | "BOOTH";

export type ServiceAllowedChannelRuleLite = {
  serviceId: string;
  channelId: string;
  active: boolean;
};

export type ServiceAllowedChannelIndex = {
  rulesByServiceId: Map<string, ServiceAllowedChannelRuleLite[]>;
  activeChannelIdsByServiceId: Map<string, Set<string>>;
};

export function buildServiceAllowedChannelIndex(
  rules: ServiceAllowedChannelRuleLite[]
): ServiceAllowedChannelIndex {
  const rulesByServiceId = new Map<string, ServiceAllowedChannelRuleLite[]>();
  const activeChannelIdsByServiceId = new Map<string, Set<string>>();

  for (const rule of rules) {
    const serviceRules = rulesByServiceId.get(rule.serviceId) ?? [];
    serviceRules.push(rule);
    rulesByServiceId.set(rule.serviceId, serviceRules);

    if (rule.active) {
      const activeChannelIds = activeChannelIdsByServiceId.get(rule.serviceId) ?? new Set<string>();
      activeChannelIds.add(rule.channelId);
      activeChannelIdsByServiceId.set(rule.serviceId, activeChannelIds);
    }
  }

  return { rulesByServiceId, activeChannelIdsByServiceId };
}

export function serviceHasAllowedChannelRules(index: ServiceAllowedChannelIndex, serviceId: string) {
  return (index.rulesByServiceId.get(serviceId)?.length ?? 0) > 0;
}

export function isChannelAllowedForService(args: {
  index: ServiceAllowedChannelIndex;
  serviceId: string;
  channelId: string;
}) {
  const { index, serviceId, channelId } = args;
  if (!serviceHasAllowedChannelRules(index, serviceId)) return true;
  return index.activeChannelIdsByServiceId.get(serviceId)?.has(channelId) ?? false;
}

export function filterChannelsForServices<TChannel extends { id: string }>(args: {
  channels: TChannel[];
  index: ServiceAllowedChannelIndex;
  serviceIds: string[];
}) {
  const uniqueServiceIds = Array.from(new Set(args.serviceIds.filter(Boolean)));
  if (uniqueServiceIds.length === 0) return args.channels;

  return args.channels.filter((channel) =>
    uniqueServiceIds.every((serviceId) =>
      isChannelAllowedForService({
        index: args.index,
        serviceId,
        channelId: channel.id,
      })
    )
  );
}

type ServiceChannelAvailabilityDb = Pick<Prisma.TransactionClient, "channel" | "serviceAllowedChannel">;

export async function assertServiceChannelCompatibilityTx(
  tx: ServiceChannelAvailabilityDb,
  args: {
    origin: ServiceChannelOrigin;
    serviceIds: string[];
    channelId: string | null | undefined;
    allowUnchanged?: {
      serviceId: string | null | undefined;
      channelId: string | null | undefined;
    };
  }
) {
  const { channelId } = args;
  if (!channelId) return;

  const normalizedServiceIds = Array.from(new Set(args.serviceIds.filter(Boolean)));
  if (normalizedServiceIds.length === 0) return;

  const allowUnchanged =
    args.allowUnchanged &&
    args.allowUnchanged.channelId === channelId &&
    args.allowUnchanged.serviceId &&
    normalizedServiceIds.length === 1 &&
    normalizedServiceIds[0] === args.allowUnchanged.serviceId;
  if (allowUnchanged) return;

  const [channel, rules] = await Promise.all([
    tx.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        visibleInStore: true,
        visibleInBooth: true,
      },
    }),
    tx.serviceAllowedChannel.findMany({
      where: { serviceId: { in: normalizedServiceIds } },
      select: {
        serviceId: true,
        channelId: true,
        active: true,
      },
    }),
  ]);

  const isVisible = channel
    ? args.origin === "BOOTH"
      ? channel.visibleInBooth
      : channel.visibleInStore
    : false;

  if (!channel || !isVisible) {
    throw new Error("El canal seleccionado no está visible en este entorno.");
  }

  const index = buildServiceAllowedChannelIndex(rules);
  const incompatibleServiceIds = normalizedServiceIds.filter(
    (serviceId) =>
      !isChannelAllowedForService({
        index,
        serviceId,
        channelId,
      })
  );

  if (incompatibleServiceIds.length > 0) {
    throw new Error("El canal seleccionado no está disponible para este servicio.");
  }
}
