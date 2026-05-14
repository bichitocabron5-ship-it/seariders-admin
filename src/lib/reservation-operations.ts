function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

export function usesQuantityAsOperationalMultiplier(category: string | null | undefined) {
  return normalizeCategory(category) === "TOWABLE";
}

export function getOperationalDurationMinutes(args: {
  category: string | null | undefined;
  durationMinutes: number | null | undefined;
  quantity: number | null | undefined;
}) {
  const baseDuration = Math.max(1, Number(args.durationMinutes ?? 0) || 1);
  const quantity = Math.max(1, Number(args.quantity ?? 0) || 1);

  return usesQuantityAsOperationalMultiplier(args.category)
    ? baseDuration * quantity
    : baseDuration;
}

export function getOperationalCapacityUnits(args: {
  category: string | null | undefined;
  quantity: number | null | undefined;
}) {
  const quantity = Math.max(1, Number(args.quantity ?? 0) || 1);
  return usesQuantityAsOperationalMultiplier(args.category) ? 1 : quantity;
}

export function getOperationalPlatformUnits(args: {
  category: string | null | undefined;
  quantity: number | null | undefined;
}) {
  return getOperationalCapacityUnits(args);
}

export function getOperationalBlockLabel(args: {
  serviceName: string | null | undefined;
  quantity: number | null | undefined;
  pax: number | null | undefined;
  durationMinutes: number | null | undefined;
  category?: string | null | undefined;
}) {
  const serviceName = String(args.serviceName ?? "").trim() || "Servicio";
  const quantity = Math.max(1, Number(args.quantity ?? 0) || 1);
  const pax = Math.max(0, Number(args.pax ?? 0) || 0);
  const durationMinutes = getOperationalDurationMinutes({
    category: args.category,
    durationMinutes: args.durationMinutes,
    quantity,
  });

  const parts = [`${serviceName} x${quantity}`];
  if (pax > 0) parts.push(`${pax} pax`);
  parts.push(`${durationMinutes} min`);
  return parts.join(" · ");
}
