// src/lib/bar-pricing.ts
type Promotion = {
  id: string;
  type: "FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y";
  exactQty?: number | null;
  fixedTotalCents?: number | null;
  buyQty?: number | null;
  payQty?: number | null;
  isActive: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

type Input = {
  unitPriceCents: number;
  quantity: number;
  promotions: Promotion[];
  staffMode?: boolean;
  staffPriceCents?: number | null;
  manualDiscountCents?: number;
};

export function calculateBarLineTotal(input: Input) {
  const {
    unitPriceCents,
    quantity,
    promotions,
    staffMode,
    staffPriceCents,
    manualDiscountCents,
  } = input;

  const requestedManualDiscountCents = Math.max(0, Math.round(manualDiscountCents ?? 0));

  if (staffMode && staffPriceCents != null) {
    const baseTotalCents = staffPriceCents * quantity;

    return {
      unitPriceCents: staffPriceCents,
      baseTotalCents,
      autoDiscountCents: 0,
      subtotalBeforeManualCents: baseTotalCents,
      manualDiscountCents: 0,
      totalCents: baseTotalCents,
      appliedPromotion: null,
      label: "Precio staff",
    };
  }

  const now = new Date();

  const activePromos = promotions.filter((p) => {
    if (!p.isActive) return false;
    if (p.startsAt && new Date(p.startsAt) > now) return false;
    if (p.endsAt && new Date(p.endsAt) < now) return false;
    return true;
  });

  const baseTotalCents = unitPriceCents * quantity;
  let bestSubtotalCents = baseTotalCents;
  let bestPromo: Promotion | null = null;

  for (const promo of activePromos) {
    let subtotalCents = baseTotalCents;

    if (promo.type === "FIXED_TOTAL_FOR_QTY" && promo.exactQty && promo.fixedTotalCents != null) {
      const packSize = promo.exactQty;

      if (quantity >= packSize) {
        const packs = Math.floor(quantity / packSize);
        const remainder = quantity % packSize;

        subtotalCents = packs * promo.fixedTotalCents + remainder * unitPriceCents;
      }
    }

    if (promo.type === "BUY_X_PAY_Y" && promo.buyQty && promo.payQty) {
      const groupSize = promo.buyQty;

      if (quantity >= groupSize) {
        const groups = Math.floor(quantity / groupSize);
        const remainder = quantity % groupSize;

        subtotalCents = groups * (promo.payQty * unitPriceCents) + remainder * unitPriceCents;
      }
    }

    if (subtotalCents < bestSubtotalCents) {
      bestSubtotalCents = subtotalCents;
      bestPromo = promo;
    }
  }

  const appliedManualDiscountCents = Math.min(
    requestedManualDiscountCents,
    Math.max(0, bestSubtotalCents - 1)
  );

  return {
    unitPriceCents,
    baseTotalCents,
    autoDiscountCents: Math.max(0, baseTotalCents - bestSubtotalCents),
    subtotalBeforeManualCents: bestSubtotalCents,
    manualDiscountCents: appliedManualDiscountCents,
    totalCents: bestSubtotalCents - appliedManualDiscountCents,
    appliedPromotion: bestPromo,
    label: bestPromo
      ? bestPromo.type === "BUY_X_PAY_Y"
        ? `Promo ${bestPromo.buyQty}x${bestPromo.payQty}`
        : `Promo ${bestPromo.exactQty} por ${(bestPromo.fixedTotalCents! / 100).toFixed(2)}€`
      : null,
  };
}

export function getBarPromotionBadge(
  promotions: Array<{
    id: string;
    type: "FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y";
    exactQty?: number | null;
    fixedTotalCents?: number | null;
    buyQty?: number | null;
    payQty?: number | null;
    isActive: boolean;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
  }>
) {
  const now = new Date();

  const active = promotions.filter((p) => {
    if (!p.isActive) return false;
    if (p.startsAt && new Date(p.startsAt) > now) return false;
    if (p.endsAt && new Date(p.endsAt) < now) return false;
    return true;
  });

  if (active.length === 0) return null;

  const promo = active[0];

  if (promo.type === "BUY_X_PAY_Y" && promo.buyQty && promo.payQty) {
    return `${promo.buyQty}x${promo.payQty}`;
  }

  if (promo.type === "FIXED_TOTAL_FOR_QTY" && promo.exactQty && promo.fixedTotalCents != null) {
    return `${promo.exactQty} por ${(promo.fixedTotalCents / 100).toFixed(2)}€`;
  }

  return null;
}
