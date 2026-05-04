type OptionLike = {
  id: string;
  serviceId: string;
  durationMinutes?: number | null;
  paxMax?: number | null;
  capacity?: number | null;
};

export type OptionPresentation = {
  isPaxCapacityOption: boolean;
  displayLabel: string;
  secondaryLabel: string | null;
};

function capacityOf(option: Pick<OptionLike, "paxMax" | "capacity">) {
  const raw = option.paxMax ?? option.capacity ?? null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatOperationalDuration(durationMinutes?: number | null) {
  const value = Number(durationMinutes ?? 0);
  return value > 0 ? `${value} min` : "Sin duración";
}

export function isPaxCapacityVariantOption(
  option: OptionLike,
  siblings: readonly OptionLike[],
) {
  const duration = Number(option.durationMinutes ?? 0);
  const capacity = capacityOf(option);
  if (!(duration > 0) || !capacity) return false;

  return (
    siblings.filter((candidate) => {
      if (candidate.serviceId !== option.serviceId) return false;
      if (candidate.id === option.id) return false;
      return Number(candidate.durationMinutes ?? 0) === duration && capacityOf(candidate) !== null;
    }).length > 0
  );
}

export function buildOptionPresentation(
  option: OptionLike,
  siblings: readonly OptionLike[],
): OptionPresentation {
  const durationText = formatOperationalDuration(option.durationMinutes);
  const capacity = capacityOf(option);
  const isPaxCapacityOption = isPaxCapacityVariantOption(option, siblings);

  if (isPaxCapacityOption && capacity) {
    return {
      isPaxCapacityOption: true,
      displayLabel: `Hasta ${capacity} pax`,
      secondaryLabel: `Duración operativa: ${durationText}`,
    };
  }

  return {
    isPaxCapacityOption: false,
    displayLabel: durationText,
    secondaryLabel: capacity ? `Hasta ${capacity} pax` : null,
  };
}

export function annotateServiceOptions<T extends OptionLike>(options: readonly T[]) {
  const byServiceId = new Map<string, T[]>();
  for (const option of options) {
    const current = byServiceId.get(option.serviceId);
    if (current) current.push(option);
    else byServiceId.set(option.serviceId, [option]);
  }

  return options.map((option) => ({
    ...option,
    ...buildOptionPresentation(option, byServiceId.get(option.serviceId) ?? []),
  }));
}
