type UnitActivityInput = {
  reservationItemId?: string | null;
  serviceId?: string | null;
  optionId?: string | null;
  serviceCategory?: string | null;
  serviceName?: string | null;
  durationMinutesSnapshot?: number | null;
  quantitySnapshot?: number | null;
  paxSnapshot?: number | null;
} | null;

type LegacyReservationActivityInput = {
  quantity?: number | null;
  pax?: number | null;
  service?: {
    id?: string | null;
    name?: string | null;
    category?: string | null;
  } | null;
  option?: {
    id?: string | null;
    durationMinutes?: number | null;
  } | null;
} | null;

export type ReservationUnitActivity = {
  serviceId: string | null;
  optionId: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  quantity: number | null;
  pax: number | null;
  source: "UNIT" | "LEGACY";
};

function hasModernUnitActivity(unit: UnitActivityInput) {
  if (!unit) return false;

  return Boolean(
    unit.reservationItemId ||
      unit.serviceId ||
      unit.optionId ||
      unit.serviceCategory ||
      unit.serviceName ||
      unit.durationMinutesSnapshot
  );
}

export function resolveReservationUnitActivity(args: {
  unit?: UnitActivityInput;
  legacyReservation?: LegacyReservationActivityInput;
}): ReservationUnitActivity {
  const unit = args.unit ?? null;

  if (hasModernUnitActivity(unit)) {
    return {
      serviceId: unit?.serviceId ?? null,
      optionId: unit?.optionId ?? null,
      serviceName: unit?.serviceName ?? null,
      serviceCategory: unit?.serviceCategory ?? null,
      durationMinutes: unit?.durationMinutesSnapshot ?? null,
      quantity: unit?.quantitySnapshot ?? null,
      pax: unit?.paxSnapshot ?? null,
      source: "UNIT",
    };
  }

  const legacy = args.legacyReservation ?? null;

  return {
    serviceId: legacy?.service?.id ?? null,
    optionId: legacy?.option?.id ?? null,
    serviceName: legacy?.service?.name ?? null,
    serviceCategory: legacy?.service?.category ?? null,
    durationMinutes: legacy?.option?.durationMinutes ?? null,
    quantity: legacy?.quantity ?? null,
    pax: legacy?.pax ?? null,
    source: "LEGACY",
  };
}
