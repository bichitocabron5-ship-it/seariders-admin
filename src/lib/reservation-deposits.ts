type ReservationDepositItem = {
  quantity: number | null;
  isExtra?: boolean | null;
  service: { category: string | null } | null;
};

type ReservationDepositPayment = {
  amountCents: number | null;
  isDeposit: boolean;
  direction?: string | null;
};

export type ReservationDepositStatus =
  | "NO_APLICA"
  | "RETENIDA"
  | "PENDIENTE"
  | "LIBERABLE"
  | "DEVUELTA";

function countJetskiUnits(items: ReservationDepositItem[]) {
  return items
    .filter((item) => !item.isExtra && String(item.service?.category ?? "").toUpperCase() === "JETSKI")
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);
}

export function computeReservationDepositCents(params: {
  storedDepositCents?: number | null;
  quantity: number | null;
  isLicense: boolean;
  serviceCategory?: string | null;
  items?: ReservationDepositItem[];
}) {
  const hasStoredDeposit = params.storedDepositCents !== null && params.storedDepositCents !== undefined;
  const stored = Math.max(0, Number(params.storedDepositCents ?? 0));
  if (hasStoredDeposit) return stored;

  const jetskiUnitsFromItems = countJetskiUnits(params.items ?? []);
  const fallbackUnits =
    jetskiUnitsFromItems > 0
      ? jetskiUnitsFromItems
      : String(params.serviceCategory ?? "").toUpperCase() === "JETSKI"
        ? Math.max(0, Number(params.quantity ?? 0))
        : 0;

  if (fallbackUnits <= 0) return stored;
  return (params.isLicense ? 50000 : 10000) * fallbackUnits;
}

export function deriveReservationDepositStatus(params: {
  depositCents: number | null;
  depositHeld?: boolean | null;
  payments?: ReservationDepositPayment[];
  paidDepositCents?: number | null;
}) {
  const depositCents = Math.max(0, Number(params.depositCents ?? 0));
  const payments = params.payments ?? [];
  const paidDepositCents =
    params.paidDepositCents != null
      ? Number(params.paidDepositCents)
      : payments
          .filter((payment) => payment.isDeposit)
          .reduce((sum, payment) => {
            const sign = payment.direction === "OUT" ? -1 : 1;
            return sum + sign * Number(payment.amountCents ?? 0);
          }, 0);

  if (params.depositHeld) return "RETENIDA" as const;

  const hadDepositIn = payments.some((payment) => payment.isDeposit && payment.direction === "IN");
  const hadDepositOut = payments.some((payment) => payment.isDeposit && payment.direction === "OUT");

  if (depositCents <= 0 && paidDepositCents <= 0 && !hadDepositIn && !hadDepositOut) {
    return "NO_APLICA" as const;
  }

  if (paidDepositCents <= 0) {
    return hadDepositIn && hadDepositOut ? "DEVUELTA" as const : "PENDIENTE" as const;
  }

  return "LIBERABLE" as const;
}

export function computeDepositFromResolvedItems(params: {
  isLicense: boolean;
  resolvedItems: Array<{ category: string | null; quantity: number | null }>;
}) {
  const jetskiUnits = params.resolvedItems
    .filter((item) => String(item.category ?? "").toUpperCase() === "JETSKI")
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);

  if (jetskiUnits <= 0) return 0;
  return (params.isLicense ? 50000 : 10000) * jetskiUnits;
}
