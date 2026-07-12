type ManualDiscountProrationArgs = {
  currentManualDiscountCents: number | null | undefined;
  oldQuantity: number | null | undefined;
  newQuantity: number | null | undefined;
  newSubtotalCents: number | null | undefined;
  explicitManualDiscountCents?: number | null;
};

function nonNegativeInt(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function positiveInt(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.trunc(amount));
}

function roundDivHalfUp(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

export function prorateManualDiscountCents(args: {
  oldManualDiscountCents: number | null | undefined;
  oldQuantity: number | null | undefined;
  newQuantity: number | null | undefined;
}) {
  const oldManualDiscountCents = nonNegativeInt(args.oldManualDiscountCents);
  const oldQuantity = positiveInt(args.oldQuantity);
  const newQuantity = positiveInt(args.newQuantity);

  if (oldManualDiscountCents <= 0 || oldQuantity <= 0 || newQuantity <= 0) return 0;

  // Integer-only cents calculation, rounded half up to the nearest cent.
  return roundDivHalfUp(oldManualDiscountCents * newQuantity, oldQuantity);
}

export function resolveManualDiscountCentsForQuantityChange(args: ManualDiscountProrationArgs) {
  const newSubtotalCents = nonNegativeInt(args.newSubtotalCents);
  const requestedManualDiscountCents =
    args.explicitManualDiscountCents !== undefined
      ? nonNegativeInt(args.explicitManualDiscountCents)
      : prorateManualDiscountCents({
          oldManualDiscountCents: args.currentManualDiscountCents,
          oldQuantity: args.oldQuantity,
          newQuantity: args.newQuantity,
        });

  return Math.min(requestedManualDiscountCents, newSubtotalCents);
}

export function resolveManualDiscountReasonForPersistence(args: {
  currentManualDiscountReason: string | null | undefined;
  explicitManualDiscountCents?: number | null;
  manualDiscountReason?: string | null;
}) {
  if (args.explicitManualDiscountCents === undefined) {
    return args.currentManualDiscountReason ?? null;
  }

  if (nonNegativeInt(args.explicitManualDiscountCents) <= 0) {
    return null;
  }

  return args.manualDiscountReason === undefined
    ? args.currentManualDiscountReason ?? null
    : args.manualDiscountReason;
}

export function sumMainReservationQuantity(
  items: Array<{ quantity?: number | null; isExtra?: boolean | null }> | null | undefined,
  fallbackQuantity?: number | null
) {
  const itemQuantity = (items ?? [])
    .filter((item) => !item.isExtra)
    .reduce((sum, item) => sum + positiveInt(item.quantity), 0);

  return itemQuantity > 0 ? itemQuantity : positiveInt(fallbackQuantity);
}
