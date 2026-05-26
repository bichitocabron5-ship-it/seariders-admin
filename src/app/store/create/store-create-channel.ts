type ChannelLike = {
  id: string;
};

export function getDisplayChannels<TChannel extends ChannelLike>(args: {
  channelId: string;
  channelsWithFallback: TChannel[];
  compatibleChannels: TChannel[];
}) {
  const { channelId, channelsWithFallback, compatibleChannels } = args;
  if (!channelId) return compatibleChannels;

  const selected = channelsWithFallback.find((channel) => channel.id === channelId);
  if (!selected || compatibleChannels.some((channel) => channel.id === selected.id)) {
    return compatibleChannels;
  }

  return [selected, ...compatibleChannels];
}

export function reconcileChannelSelectionOnServiceChange<TChannel extends ChannelLike>(args: {
  previousServiceId: string;
  serviceId: string;
  channelId: string;
  compatibleChannels: TChannel[];
}) {
  const { previousServiceId, serviceId, channelId, compatibleChannels } = args;

  if (!serviceId || !previousServiceId || previousServiceId === serviceId) {
    return { nextChannelId: channelId, notice: null as string | null };
  }

  if (!channelId || compatibleChannels.some((channel) => channel.id === channelId)) {
    return { nextChannelId: channelId, notice: null as string | null };
  }

  return {
    nextChannelId: "",
    notice: "El canal seleccionado no está disponible para este servicio.",
  };
}

export function resolveCompatibleChannelFallback<TChannel extends ChannelLike>(args: {
  channelId: string;
  channelCompatibilityNotice: string | null;
  compatibleChannels: TChannel[];
}) {
  const { channelId, channelCompatibilityNotice, compatibleChannels } = args;
  if (channelId || channelCompatibilityNotice || compatibleChannels.length === 0) {
    return channelId;
  }

  return compatibleChannels[0]?.id ?? "";
}
