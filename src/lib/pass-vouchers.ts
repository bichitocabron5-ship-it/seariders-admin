type PaymentLike = {
  amountCents?: number | null;
  direction?: "IN" | "OUT" | null;
};

export function getSignedPaymentCents(payment: PaymentLike | null | undefined) {
  if (!payment) return 0;
  const amount = Number(payment.amountCents ?? 0);
  return payment.direction === "OUT" ? -amount : amount;
}

export function getPassVoucherPaidCents(params: {
  soldPayment?: PaymentLike | null;
  salePayments?: PaymentLike[] | null;
}) {
  const legacy = getSignedPaymentCents(params.soldPayment);
  const linked = (params.salePayments ?? []).reduce((acc, payment) => acc + getSignedPaymentCents(payment), 0);
  return Math.max(0, legacy + linked);
}

export function getPassVoucherPendingCents(totalCents: number, paidCents: number) {
  return Math.max(0, Number(totalCents ?? 0) - Number(paidCents ?? 0));
}
