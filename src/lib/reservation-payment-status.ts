import { computeReservationDepositCents } from "@/lib/reservation-deposits";

type PaymentLike = {
  amountCents: number | null | undefined;
  isDeposit: boolean | null | undefined;
  direction: string | null | undefined;
};

type ReservationPaymentStatusArgs = {
  totalPriceCents: number | null | undefined;
  depositCents: number | null | undefined;
  quantity: number | null | undefined;
  isLicense: boolean | null | undefined;
  serviceCategory: string | null | undefined;
  items?: Array<{
    quantity: number | null | undefined;
    isExtra: boolean | null | undefined;
    service?: { category: string | null | undefined } | null;
  }> | null;
  payments?: PaymentLike[] | null;
};

function signedAmount(amountCents: number | null | undefined, direction: string | null | undefined) {
  const amount = Number(amountCents ?? 0);
  return direction === "OUT" ? -amount : amount;
}

export function getReservationPaymentStatus(args: ReservationPaymentStatusArgs) {
  const serviceDueCents = Math.max(0, Number(args.totalPriceCents ?? 0));
  const depositDueCents = computeReservationDepositCents({
    storedDepositCents: args.depositCents,
    quantity: args.quantity ?? null,
    isLicense: Boolean(args.isLicense),
    serviceCategory: args.serviceCategory ?? null,
    items:
      (args.items ?? []).map((item) => ({
        quantity: item.quantity ?? 0,
        isExtra: Boolean(item.isExtra),
        service: item.service ? { category: item.service.category ?? null } : null,
      })) ?? [],
  });

  const paidServiceCents = (args.payments ?? [])
    .filter((payment) => !payment.isDeposit)
    .reduce((sum, payment) => sum + signedAmount(payment.amountCents, payment.direction), 0);

  const paidDepositCents = (args.payments ?? [])
    .filter((payment) => payment.isDeposit)
    .reduce((sum, payment) => sum + signedAmount(payment.amountCents, payment.direction), 0);

  const pendingServiceCents = Math.max(0, serviceDueCents - paidServiceCents);
  const pendingDepositCents = Math.max(0, depositDueCents - paidDepositCents);

  return {
    serviceDueCents,
    depositDueCents,
    paidServiceCents,
    paidDepositCents,
    pendingServiceCents,
    pendingDepositCents,
    fullyPaid: pendingServiceCents === 0 && pendingDepositCents === 0,
  };
}
