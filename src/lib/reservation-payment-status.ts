import { computeReservationDepositCents } from "./reservation-deposits";
import { resolveChargeableServiceDueCents } from "./reservation-commercial-snapshot";

type PaymentLike = {
  amountCents: number | null | undefined;
  isDeposit: boolean | null | undefined;
  direction: string | null | undefined;
  method?: string | null | undefined;
};

export type ReservationPaymentState =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "CANCELED"
  | "REFUNDED";

type ReservationPaymentStatusArgs = {
  reservationStatus?: string | null | undefined;
  giftVoucherId?: string | null | undefined;
  passVoucherId?: string | null | undefined;
  passConsumeId?: string | null | undefined;
  totalPriceCents: number | null | undefined;
  depositCents: number | null | undefined;
  quantity: number | null | undefined;
  isLicense: boolean | null | undefined;
  serviceCategory: string | null | undefined;
  items?: Array<{
    quantity: number | null | undefined;
    isExtra: boolean | null | undefined;
    totalPriceCents?: number | null | undefined;
    service?: { category: string | null | undefined } | null;
  }> | null;
  payments?: PaymentLike[] | null;
};

function signedAmount(amountCents: number | null | undefined, direction: string | null | undefined) {
  const amount = Number(amountCents ?? 0);
  return direction === "OUT" ? -amount : amount;
}

export function getReservationPaymentMethodLabel(method: string | null | undefined) {
  switch (String(method ?? "").toUpperCase()) {
    case "CASH":
      return "Efectivo";
    case "CARD":
      return "Tarjeta";
    case "TRANSFER":
      return "Transferencia";
    case "BIZUM":
      return "Bizum";
    case "VOUCHER":
      return "Voucher";
    default:
      return "Sin metodo";
  }
}

export function getReservationPaymentStateLabel(state: ReservationPaymentState) {
  switch (state) {
    case "PENDING":
      return "Pendiente";
    case "PARTIAL":
      return "Pago parcial";
    case "PAID":
      return "Pagado";
    case "CANCELED":
      return "Anulado";
    case "REFUNDED":
      return "Devuelto";
    default:
      return state;
  }
}

export function resolveReservationPaymentStatus(args: ReservationPaymentStatusArgs) {
  const serviceDueCents = resolveChargeableServiceDueCents({
    giftVoucherId: args.giftVoucherId,
    passVoucherId: args.passVoucherId,
    passConsumeId: args.passConsumeId,
    totalPriceCents: args.totalPriceCents,
    items: (args.items ?? []).map((item) => ({
      isExtra: Boolean(item.isExtra),
      totalPriceCents: item.totalPriceCents ?? null,
    })),
  });
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
  const overpaidServiceCents = Math.max(0, paidServiceCents - serviceDueCents);
  const overpaidDepositCents = Math.max(0, paidDepositCents - depositDueCents);
  const status = String(args.reservationStatus ?? "").toUpperCase();
  const isCanceled = status === "CANCELED";
  const servicePayments = (args.payments ?? []).filter((payment) => !payment.isDeposit);
  const hadServiceRefund = servicePayments.some((payment) => payment.direction === "OUT");
  const displayPendingServiceCents = isCanceled ? 0 : pendingServiceCents;
  const displayPendingDepositCents = isCanceled ? 0 : pendingDepositCents;
  const displayPendingCents = displayPendingServiceCents + displayPendingDepositCents;

  let state: ReservationPaymentState;
  if (isCanceled) {
    state = "CANCELED";
  } else if (hadServiceRefund && paidServiceCents <= 0 && serviceDueCents > 0) {
    state = "REFUNDED";
  } else if (displayPendingCents === 0) {
    state = "PAID";
  } else if (paidServiceCents > 0 || paidDepositCents > 0) {
    state = "PARTIAL";
  } else {
    state = "PENDING";
  }

  const collectedByMethodMap = new Map<
    string,
    { method: string; label: string; serviceCents: number; depositCents: number; totalCents: number }
  >();

  for (const payment of args.payments ?? []) {
    const method = String(payment.method ?? "UNKNOWN").toUpperCase();
    const current =
      collectedByMethodMap.get(method) ??
      {
        method,
        label: getReservationPaymentMethodLabel(method),
        serviceCents: 0,
        depositCents: 0,
        totalCents: 0,
      };
    const amount = signedAmount(payment.amountCents, payment.direction);
    if (payment.isDeposit) {
      current.depositCents += amount;
    } else {
      current.serviceCents += amount;
    }
    current.totalCents += amount;
    collectedByMethodMap.set(method, current);
  }

  return {
    state,
    label: getReservationPaymentStateLabel(state),
    serviceDueCents,
    depositDueCents,
    paidServiceCents,
    paidDepositCents,
    pendingServiceCents,
    pendingDepositCents,
    overpaidServiceCents,
    overpaidDepositCents,
    displayPendingServiceCents,
    displayPendingDepositCents,
    displayPendingCents,
    collectedByMethod: Array.from(collectedByMethodMap.values()).filter((entry) => entry.totalCents !== 0),
    fullyPaid: pendingServiceCents === 0 && pendingDepositCents === 0,
  };
}

export const getReservationPaymentStatus = resolveReservationPaymentStatus;
