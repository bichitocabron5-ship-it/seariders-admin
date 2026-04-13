export function getBoothUnitDiscountCents(args: {
  source: string | null | undefined;
  matchingQuantity: number | null | undefined;
  manualDiscountCents: number | null | undefined;
}) {
  if (args.source !== "BOOTH") return 0;
  const qty = Math.max(1, Number(args.matchingQuantity ?? 0));
  const totalDiscount = Math.max(0, Number(args.manualDiscountCents ?? 0));
  if (totalDiscount <= 0) return 0;
  return totalDiscount / qty;
}

export function getScaledBoothDiscountCents(args: {
  boothUnitDiscountCents: number;
  nextMatchingQuantity: number | null | undefined;
}) {
  if (args.boothUnitDiscountCents <= 0) return 0;
  const qty = Math.max(0, Number(args.nextMatchingQuantity ?? 0));
  return Math.max(0, Math.round(args.boothUnitDiscountCents * qty));
}
