import { normalizeCommercialValueMode, roundCents, type CommercialValueMode } from "@/lib/commission";

type ChannelCommercialState = {
  customerDiscountMode?: CommercialValueMode | null;
  customerDiscountValue?: number | null;
  customerDiscountCents?: number | null;
  promoterCommissionMode?: CommercialValueMode | null;
  promoterCommissionValue?: number | null;
  promoterCommissionCents?: number | null;
};

type ChannelCommercialPatch = {
  customerDiscountMode?: CommercialValueMode;
  customerDiscountValue?: number;
  customerDiscountCents?: number;
  promoterCommissionMode?: CommercialValueMode;
  promoterCommissionValue?: number;
  promoterCommissionCents?: number;
};

export function resolveChannelCommercialPatch(
  current: ChannelCommercialState,
  patch: ChannelCommercialPatch
) {
  const nextCustomerMode = normalizeCommercialValueMode(
    patch.customerDiscountMode ?? current.customerDiscountMode
  );
  const nextPromoterMode = normalizeCommercialValueMode(
    patch.promoterCommissionMode ?? current.promoterCommissionMode
  );

  const touchesCustomer =
    patch.customerDiscountMode !== undefined ||
    patch.customerDiscountValue !== undefined ||
    patch.customerDiscountCents !== undefined;
  const touchesPromoter =
    patch.promoterCommissionMode !== undefined ||
    patch.promoterCommissionValue !== undefined ||
    patch.promoterCommissionCents !== undefined;

  return {
    customerDiscountMode: patch.customerDiscountMode,
    customerDiscountValue: patch.customerDiscountValue,
    customerDiscountCents: !touchesCustomer
      ? undefined
      : nextCustomerMode === "FIXED"
        ? Math.max(
            0,
            roundCents(
              patch.customerDiscountCents ??
                Math.round((patch.customerDiscountValue ?? current.customerDiscountValue ?? 0) * 100)
            )
          )
        : 0,
    promoterCommissionMode: patch.promoterCommissionMode,
    promoterCommissionValue: patch.promoterCommissionValue,
    promoterCommissionCents: !touchesPromoter
      ? undefined
      : nextPromoterMode === "FIXED"
        ? Math.max(
            0,
            roundCents(
              patch.promoterCommissionCents ??
                Math.round((patch.promoterCommissionValue ?? current.promoterCommissionValue ?? 0) * 100)
            )
          )
        : 0,
  };
}
