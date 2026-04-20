// src/lib/cashClosureLock.ts
import { prisma } from "@/lib/prisma";
import { PaymentOrigin, RoleName, ShiftName } from "@prisma/client";
import { normalizeClosureShift, originFromRoleName } from "@/lib/cashClosures";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { BUSINESS_TZ, todayYmdInTz, utcDateFromYmdInTz } from "@/lib/tz-business";

// Ajusta las horas a TU operativa (me dijiste carpa 9-14 y 14-19)
export function shiftFromNow(now = new Date()): ShiftName {
  const h = now.getHours() + now.getMinutes() / 60;

  // MORNING: 09:00–14:00, AFTERNOON: 14:00–19:00
  // (si fuera fuera de rango, decide una política; aquí lo dejo como MORNING por defecto)
  if (h >= 14 && h < 19) return "AFTERNOON";
  return "MORNING";
}

/**
 * Devuelve { origin, shift, businessDate } para bloquear:
 * - origin se deduce por rol (STORE/BOOTH/BAR)
 * - shift: si tu sesión ya guarda shift en ShiftSession activa, usa eso; si no, usa shiftFromNow()
 */
export async function getLockKeyForUser(userId: string, role: RoleName, shiftSessionId?: string | null) {
  const origin = originFromRoleName(role);
  if (!origin) return null;

  const now = new Date();
  const ss = await findCurrentShiftSession({ userId, role, shiftSessionId });
  const shift = normalizeClosureShift(origin, ss?.shift ?? shiftFromNow(now));
  const businessDate = utcDateFromYmdInTz(BUSINESS_TZ, todayYmdInTz(BUSINESS_TZ, now));

  return { origin: origin as PaymentOrigin, shift: shift as ShiftName, businessDate };
}

export async function assertCashOpenForUser(userId: string, role: RoleName, shiftSessionId?: string | null) {
  const key = await getLockKeyForUser(userId, role, shiftSessionId);
  if (!key) return; // ADMIN/PLATFORM no cobran como origin

  const activeClosure = await prisma.cashClosure.findFirst({
    where: {
      origin: key.origin,
      businessDate: key.businessDate,
      isVoided: false,
      ...(key.origin === "BOOTH" ? { shift: key.shift } : {}),
    },
    select: { id: true, closedAt: true },
  });

  if (activeClosure) {
    throw new Error("Caja cerrada para este turno. Pide a ADMIN que la reabra.");
  }
}
