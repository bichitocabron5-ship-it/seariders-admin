import { computeAutoDiscountDetail } from "@/lib/discounts";
import type { DiscountResponsibility } from "@/lib/commission";
import {
  finalizeReservationCommercialBreakdown,
} from "@/lib/reservation-commercial-breakdown";

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
  customerDiscountCents?: number | null;
  manualDiscountCents?: number | null;
  discountResponsibility: DiscountResponsibility;
  promoterDiscountShareBps?: number | null;
  allowAutoDiscount?: boolean;
};

function roundMoney(value: number) {
  return Math.round(Number(value ?? 0));
}

export async function computeReservationCommercialBreakdown(
  args: ComputeReservationCommercialArgs
) {
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

  const uniquePromoCodes = Array.from(
    new Set(
      args.discountLines
        .map((line) => String(line.promoCode ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const commercial = finalizeReservationCommercialBreakdown({
    totalBeforeDiscountsCents: args.totalBeforeDiscountsCents,
    customerDiscountCents: args.customerDiscountCents,
    autoDiscountCents,
    manualDiscountCents: args.manualDiscountCents,
    discountResponsibility: args.discountResponsibility,
    promoterDiscountShareBps: args.promoterDiscountShareBps ?? null,
  });

  return {
    promoCode: args.promotionsEnabled && uniquePromoCodes.length === 1 ? uniquePromoCodes[0] : null,
    ...commercial,
  };
}
