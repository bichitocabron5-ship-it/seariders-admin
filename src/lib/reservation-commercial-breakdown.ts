import {
  computeCommissionableBase,
  type DiscountResponsibility,
} from "@/lib/commission";

type FinalizeReservationCommercialArgs = {
  totalBeforeDiscountsCents: number;
  customerDiscountCents?: number | null;
  autoDiscountCents?: number | null;
  manualDiscountCents?: number | null;
  discountResponsibility: DiscountResponsibility;
  promoterDiscountShareBps?: number | null;
};

function roundMoney(value: number) {
  return Math.round(Number(value ?? 0));
}

export function capManualDiscountCents(
  totalBeforeDiscountsCents: number,
  manualDiscountCents: number | null | undefined
) {
  const total = Math.max(0, roundMoney(totalBeforeDiscountsCents));
  const requested = Math.max(0, roundMoney(manualDiscountCents ?? 0));
  const maxManual = Math.floor(total * 0.5);
  return Math.max(0, Math.min(requested, maxManual));
}

export function finalizeReservationCommercialBreakdown(
  args: FinalizeReservationCommercialArgs
) {
  const totalBeforeDiscountsCents = Math.max(0, roundMoney(args.totalBeforeDiscountsCents));
  const customerDiscountCents = Math.max(0, roundMoney(args.customerDiscountCents ?? 0));
  const autoDiscountCents = Math.max(0, roundMoney(args.autoDiscountCents ?? 0));
  const manualDiscountCents = capManualDiscountCents(
    Math.max(0, totalBeforeDiscountsCents - customerDiscountCents),
    args.manualDiscountCents
  );
  const totalDiscountCents = customerDiscountCents + autoDiscountCents + manualDiscountCents;

  // Discount responsibility applies only to the manual discount entered by staff.
  const commissionBreakdown = computeCommissionableBase({
    grossBaseCents: totalBeforeDiscountsCents,
    totalDiscountCents: manualDiscountCents,
    responsibility: args.discountResponsibility,
    promoterDiscountShareBps: args.promoterDiscountShareBps ?? null,
  });

  return {
    totalBeforeDiscountsCents,
    customerDiscountCents,
    autoDiscountCents,
    manualDiscountCents,
    totalDiscountCents,
    finalTotalCents: Math.max(0, totalBeforeDiscountsCents - totalDiscountCents),
    ...commissionBreakdown,
  };
}
