import { computeAutoDiscountDetail } from "@/lib/discounts";
import { computeCommissionableBase, type DiscountResponsibility } from "@/lib/commission";

type DiscountLineInput = {
  serviceId: string;
  optionId: string | null;
  category: string | null;
  quantity: number;
  lineBaseCents: number;
  promoCode?: string | null;
};

type ComputeReservationCommercialArgs = {
  when: Date;
  discountLines: DiscountLineInput[];
  customerCountry?: string | null;
  promotionsEnabled: boolean;
  totalBeforeDiscountsCents: number;
  manualDiscountCents?: number | null;
  discountResponsibility: DiscountResponsibility;
  promoterDiscountShareBps?: number | null;
  allowAutoDiscount?: boolean;
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

export async function computeReservationCommercialBreakdown(
  args: ComputeReservationCommercialArgs
) {
  const totalBeforeDiscountsCents = Math.max(0, roundMoney(args.totalBeforeDiscountsCents));
  const manualDiscountCents = capManualDiscountCents(
    totalBeforeDiscountsCents,
    args.manualDiscountCents
  );

  let autoDiscountCents = 0;
  if (args.promotionsEnabled && args.allowAutoDiscount !== false) {
    for (const line of args.discountLines) {
      const detail = await computeAutoDiscountDetail({
        when: args.when,
        item: {
          serviceId: line.serviceId,
          optionId: line.optionId,
          category: line.category,
          isExtra: false,
          lineBaseCents: Math.max(0, roundMoney(line.lineBaseCents)),
          quantity: Math.max(1, Number(line.quantity ?? 1)),
        },
        promoCode: line.promoCode ?? null,
        customerCountry: args.customerCountry ?? null,
        promotionsEnabled: args.promotionsEnabled,
      });
      autoDiscountCents += Number(detail.discountCents ?? 0);
    }
  }

  const totalDiscountCents = autoDiscountCents + manualDiscountCents;
  const commissionBreakdown = computeCommissionableBase({
    grossBaseCents: totalBeforeDiscountsCents,
    totalDiscountCents,
    responsibility: args.discountResponsibility,
    promoterDiscountShareBps: args.promoterDiscountShareBps ?? null,
  });

  const uniquePromoCodes = Array.from(
    new Set(
      args.discountLines
        .map((line) => String(line.promoCode ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  return {
    totalBeforeDiscountsCents,
    autoDiscountCents,
    manualDiscountCents,
    totalDiscountCents,
    finalTotalCents: Math.max(0, totalBeforeDiscountsCents - totalDiscountCents),
    promoCode: args.promotionsEnabled && uniquePromoCodes.length === 1 ? uniquePromoCodes[0] : null,
    ...commissionBreakdown,
  };
}
