// src/lib/cashClosures.ts
import { PaymentMethod, PaymentOrigin, PaymentDirection, RoleName, ShiftName } from "@prisma/client";
import { getSlotPolicy } from "@/lib/slotting";
import { BUSINESS_TZ, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { getBusinessDate, getBusinessDayRange } from "@/lib/business-day";

export const METHODS: PaymentMethod[] = ["CASH", "CARD", "BIZUM", "TRANSFER", "VOUCHER"] as const;

export type MethodMap = Record<PaymentMethod, number>;
export type ClosureTotals = {
  service: MethodMap;
  deposit: MethodMap;
  total: MethodMap;
  netService: number;
  netDeposit: number;
  netTotal: number;
};

export function emptyMethodMap(): MethodMap {
  return { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
}

export function sumByMethod(payments: Array<{
  amountCents: number;
  direction: PaymentDirection;
  method: PaymentMethod;
  isDeposit: boolean;
}>): ClosureTotals {
  const service = emptyMethodMap();
  const deposit = emptyMethodMap();

  for (const p of payments) {
    const sign = p.direction === "OUT" ? -1 : 1;
    const v = sign * Number(p.amountCents || 0);
    if (p.isDeposit) deposit[p.method] += v;
    else service[p.method] += v;
  }

  const total = emptyMethodMap();
  for (const m of METHODS) total[m] = service[m] + deposit[m];

  const netService = METHODS.reduce((s, m) => s + service[m], 0);
  const netDeposit = METHODS.reduce((s, m) => s + deposit[m], 0);
  const netTotal = METHODS.reduce((s, m) => s + total[m], 0);

  return { service, deposit, total, netService, netDeposit, netTotal };
}

export function diffTotals(declared: ClosureTotals, system: ClosureTotals): ClosureTotals {
  const service = emptyMethodMap();
  const deposit = emptyMethodMap();
  const total = emptyMethodMap();

  for (const m of METHODS) {
    service[m] = (declared.service[m] ?? 0) - (system.service[m] ?? 0);
    deposit[m] = (declared.deposit[m] ?? 0) - (system.deposit[m] ?? 0);
    total[m] = (declared.total[m] ?? 0) - (system.total[m] ?? 0);
  }

  return {
    service,
    deposit,
    total,
    netService: (declared.netService ?? 0) - (system.netService ?? 0),
    netDeposit: (declared.netDeposit ?? 0) - (system.netDeposit ?? 0),
    netTotal: (declared.netTotal ?? 0) - (system.netTotal ?? 0),
  };
}

export function originFromRoleName(role: RoleName): PaymentOrigin | null {
  switch (role) {
    case "STORE": return "STORE";
    case "BOOTH": return "BOOTH";
    case "BAR": return "BAR";
    default: return null; // ADMIN / PLATFORM / WEB no cobran como origin (de momento)
  }
}

/**
 * ✅ Config: qué origins se cierran por turno “real” (partido) y cuáles por “todo el día”.
 * - BOOTH: partido siempre.
 * - STORE/BAR: de momento todo el día (aunque elijan mañana/tarde).
 *   En temporada alta, cambias STORE y BAR a true.
 */
const SPLIT_BY_SHIFT: Partial<Record<PaymentOrigin, boolean>> = {
  BOOTH: false,
  STORE: false,
  BAR: false,
  WEB: false,
};

export function isOriginSplitByShift(origin: PaymentOrigin) {
  return Boolean(SPLIT_BY_SHIFT[origin]);
}

export function normalizeClosureShift(origin: PaymentOrigin, shift: ShiftName): ShiftName {
  return isOriginSplitByShift(origin) ? shift : "MORNING";
}

function dayStart(businessDate: Date) {
  return getBusinessDayRange(getBusinessDate(businessDate)).start;
}

/**
 * Ventanas de turno por origin.
 * - businessDate = día operativo (00:00)
 */
export function shiftWindow(
  origin: PaymentOrigin,
  businessDate: Date,
  shift: ShiftName
): { from: Date; to: Date } {
  const d0 = dayStart(businessDate);
  const ymd = getBusinessDate(businessDate);

  // ✅ Si NO está partido: todo el día, independientemente de MORNING/AFTERNOON
  if (!isOriginSplitByShift(origin)) {
    return { from: d0, to: getBusinessDayRange(ymd).endExclusive };
  }

  // ✅ BOOTH partido (9–14 / 14–19)
  // Ajusta aquí si cambian horarios
  const from = utcDateTimeFromYmdHmInTz(BUSINESS_TZ, ymd, shift === "MORNING" ? "09:00" : "14:00");
  const to = utcDateTimeFromYmdHmInTz(BUSINESS_TZ, ymd, shift === "MORNING" ? "14:00" : "19:00");

  if (!from || !to) throw new Error("No se pudo resolver la ventana de turno.");

  return { from, to };
}

export function parseBusinessDate(yyyyMmDd?: string) {
  return yyyyMmDd ? getBusinessDayRange(yyyyMmDd).start : getBusinessDayRange().start;
}

function ymdFromBusinessDate(businessDate: Date) {
  return getBusinessDate(businessDate);
}

export async function getClosureWindow(
  origin: PaymentOrigin,
  businessDate: Date,
  shift: ShiftName
): Promise<{ from: Date; to: Date }> {
  if (isOriginSplitByShift(origin)) {
    return shiftWindow(origin, businessDate, shift);
  }

  const policy = await getSlotPolicy();
  const ymd = ymdFromBusinessDate(businessDate);
  const from = utcDateTimeFromYmdHmInTz(BUSINESS_TZ, ymd, policy.openTime);
  const to = utcDateTimeFromYmdHmInTz(BUSINESS_TZ, ymd, policy.closeTime);

  if (!from || !to) {
    throw new Error("No se pudo resolver la ventana de cierre desde SlotPolicy.");
  }

  return { from, to };
}
