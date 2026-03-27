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
};

export function calculateBarLineTotal(input: Input) {
  const {
    unitPriceCents,
    quantity,
    promotions,
    staffMode,
    staffPriceCents,
  } = input;

  // 🔒 STAFF MODE PRIORITY
  if (staffMode && staffPriceCents != null) {
    return {
      unitPriceCents: staffPriceCents,
      totalCents: staffPriceCents * quantity,
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

  let bestTotal = unitPriceCents * quantity;
  let bestPromo: Promotion | null = null;

  for (const promo of activePromos) {
    let total = unitPriceCents * quantity;

    // =========================
    // FIXED_TOTAL_FOR_QTY
    // =========================
    if (
      promo.type === "FIXED_TOTAL_FOR_QTY" &&
      promo.exactQty &&
      promo.fixedTotalCents != null
    ) {
      const packSize = promo.exactQty;

      if (quantity >= packSize) {
        const packs = Math.floor(quantity / packSize);
        const remainder = quantity % packSize;

        total =
          packs * promo.fixedTotalCents +
          remainder * unitPriceCents;
      }
    }

    // =========================
    // BUY_X_PAY_Y
    // =========================
    if (
      promo.type === "BUY_X_PAY_Y" &&
      promo.buyQty &&
      promo.payQty
    ) {
      const groupSize = promo.buyQty;

      if (quantity >= groupSize) {
        const groups = Math.floor(quantity / groupSize);
        const remainder = quantity % groupSize;

        total =
          groups * (promo.payQty * unitPriceCents) +
          remainder * unitPriceCents;
      }
    }

    if (total < bestTotal) {
      bestTotal = total;
      bestPromo = promo;
    }
  }

  return {
    unitPriceCents,
    totalCents: bestTotal,
    appliedPromotion: bestPromo,
    label: bestPromo
      ? bestPromo.type === "BUY_X_PAY_Y"
        ? `Promo ${bestPromo.buyQty}x${bestPromo.payQty}`
        : `Promo ${bestPromo.exactQty} por ${(bestPromo.fixedTotalCents! / 100).toFixed(2)}€`
      : null,
  };
}

export function getBarPromotionBadge(promotions: Array<{
  id: string;
  type: "FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y";
  exactQty?: number | null;
  fixedTotalCents?: number | null;
  buyQty?: number | null;
  payQty?: number | null;
  isActive: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
}>) {
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

  if (
    promo.type === "FIXED_TOTAL_FOR_QTY" &&
    promo.exactQty &&
    promo.fixedTotalCents != null
  ) {
    return `${promo.exactQty} por ${(promo.fixedTotalCents / 100).toFixed(2)}€`;
  }

  return null;
}