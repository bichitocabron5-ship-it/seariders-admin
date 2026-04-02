// src/lib/cashClosures.ts
import { PaymentMethod, PaymentOrigin, PaymentDirection, RoleName, ShiftName } from "@prisma/client";

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
  BOOTH: true,
  STORE: false,
  BAR: false,
  WEB: false,
};

export function isOriginSplitByShift(origin: PaymentOrigin) {
  return Boolean(SPLIT_BY_SHIFT[origin]);
}

function dayStart(businessDate: Date) {
  const d0 = new Date(businessDate);
  d0.setHours(0, 0, 0, 0);
  return d0;
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

  // ✅ Si NO está partido: todo el día, independientemente de MORNING/AFTERNOON
  if (!isOriginSplitByShift(origin)) {
    const from = new Date(d0);
    const to = new Date(d0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // ✅ BOOTH partido (9–14 / 14–19)
  // Ajusta aquí si cambian horarios
  const from = new Date(d0);
  const to = new Date(d0);

  if (shift === "MORNING") {
    from.setHours(9, 0, 0, 0);
    to.setHours(14, 0, 0, 0);
  } else {
    from.setHours(14, 0, 0, 0);
    to.setHours(19, 0, 0, 0);
  }

  return { from, to };
}

export function parseBusinessDate(yyyyMmDd?: string) {
  const d = yyyyMmDd ? new Date(yyyyMmDd + "T00:00:00.000") : new Date();
  if (!Number.isFinite(d.getTime())) throw new Error("date inválida");
  d.setHours(0, 0, 0, 0);
  return d;
}
