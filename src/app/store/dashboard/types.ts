export type ReservationPayment = {
  amountCents: number;
  isDeposit: boolean;
  direction?: "IN" | "OUT";
  method?: string;
  origin?: string;
  createdAt?: string;
};

export type ReservationExtra = {
  id: string;
  serviceName: string;
  quantity: number;
  totalPriceCents: number;
};

export type ReservationRow = {
  arrivalAt: string | null;
  id: string;
  formalizedAt?: string | null;
  storeFlowStage?: string | null;
  source: "STORE" | "BOOTH" | "WEB";
  boothCode?: string | null;
  boothNote?: string | null;
  arrivedStoreAt?: string | null;
  status: string;
  activityDate: string;
  scheduledTime: string | null;
  customerName: string | null;
  customerPhone: string | null;
  pax: number;
  quantity: number;
  totalPriceCents: number;
  soldTotalCents: number;
  pvpTotalCents?: number;
  isLicense: boolean;
  paidCents: number;
  paidDepositCents?: number;
  depositCents: number;
  depositStatus?: "NO_APLICA" | "RETENIDA" | "PENDIENTE" | "LIBERABLE" | "DEVUELTA";
  totalToChargeCents: number;
  channelName: string | null;
  serviceName?: string | null;
  durationMinutes?: number | null;
  extras?: ReservationExtra[];
  payments?: ReservationPayment[];
  taxiboatTrip?: { boat: string; departedAt?: string } | null;
  depositHeld?: boolean;
  depositHoldReason?: string | null;
  pendingServiceCents?: number;
  pendingDepositCents?: number;
  pendingCents?: number;
  serviceTotalCents?: number;
  extrasTotalCents?: number;
  paidServiceCents?: number;
  autoDiscountCents?: number;
  manualDiscountCents?: number;
  manualDiscountReason?: string | null;
  finalTotalCents?: number;
  platformExtrasPendingCount?: number;
  contractsBadge?: {
    requiredUnits?: number;
    readyCount?: number;
  };
};

export type Service = { id: string; name: string; category: string };

export type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

export type PayLine = {
  amountEuros: string;
  method: PayMethod;
  receivedEuros?: string;
};

export type ReturnSettlementMode =
  | "AUTO"
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "RETAIN_ALL";

export type CompleteReturnInput = {
  reservationId: string;
  settlementMode?: ReturnSettlementMode;
  refundAmountCents?: number;
  refundMethod?: PayMethod;
  retainReason?: string;
};

export type CashSummary = {
  count: number;
  totalCents: number;
  serviceCents: number;
  depositCents: number;
  byMethod: Record<string, { netCents: number }>;
  byOrigin: Record<string, { netCents: number }>;
};

export type CashClosureSummary = {
  ok: true;
  computed: unknown;
  isClosed: boolean;
  closure: { id: string; closedAt: string } | null;
};

export type TotalsSummary = {
  dayCount: number;
  dayTotalCents: number;
  pendingCount: number;
  pendingCents: number;
  paidCount: number;
  paidCents: number;
};

export type CommissionSummary = {
  count: number;
  totalCommissionCents: number;
  byChannel: Record<string, number>;
  byOrigin: Record<string, { totalCommissionCents: number; byChannel: Record<string, number> }>;
};

export type ExtraUiMap = Record<string, { extraServiceId: string; qty: number }>;
