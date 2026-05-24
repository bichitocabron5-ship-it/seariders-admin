type SlotConfigReader = {
  slotPolicy: {
    findFirst(args: unknown): Promise<{
      intervalMinutes: number | null;
      openTime: string | null;
      closeTime: string | null;
    } | null>;
  };
  slotLimit: {
    findUnique(args: unknown): Promise<{ maxUnits: number } | null>;
  };
};

export type SlotConfig = {
  intervalMinutes: number;
  openTime: string;
  closeTime: string;
};

export function buildConfigurationRequiredError(message: string) {
  return new Error(`CONFIGURATION_REQUIRED: ${message}`);
}

export async function getSlotConfigOrThrow(tx: SlotConfigReader) {
  const policy = await tx.slotPolicy.findFirst({ orderBy: { createdAt: "desc" } });
  if (!policy) {
    throw buildConfigurationRequiredError("SlotPolicy no configurado.");
  }

  return {
    intervalMinutes: policy.intervalMinutes ?? 30,
    openTime: policy.openTime ?? "09:00",
    closeTime: policy.closeTime ?? "20:00",
  } satisfies SlotConfig;
}

export async function getSlotLimitOrThrow(
  tx: SlotConfigReader,
  category: string
) {
  const normalizedCategory = String(category ?? "").trim().toUpperCase();
  const limit = await tx.slotLimit.findUnique({
    where: { category: normalizedCategory },
    select: { maxUnits: true },
  });

  if (!limit) {
    throw buildConfigurationRequiredError(`SlotLimit no configurado para ${normalizedCategory}.`);
  }

  return limit;
}
