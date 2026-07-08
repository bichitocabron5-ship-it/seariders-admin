import { normalizePromoCode } from "@/lib/reservation-commercial-snapshot";

type ReservationPrefillItemSnapshot = {
  serviceId: string;
  optionId?: string | null;
  servicePriceId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  isExtra?: boolean | null;
  unitPriceCents?: number | null;
  totalPriceCents?: number | null;
};

export function buildReservationPrefillCartItems(args: {
  promoCode?: string | null;
  fallbackOptionId?: string | null;
  items?: ReservationPrefillItemSnapshot[] | null;
}) {
  const promoCode = normalizePromoCode(args.promoCode);

  return (args.items ?? [])
    .filter((item) => !item.isExtra)
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId ?? args.fallbackOptionId ?? "",
      servicePriceId: item.servicePriceId ?? null,
      quantity: item.quantity,
      pax: item.pax,
      promoCode,
      unitPriceCents: item.unitPriceCents ?? null,
      totalPriceCents: item.totalPriceCents ?? null,
    }));
}
