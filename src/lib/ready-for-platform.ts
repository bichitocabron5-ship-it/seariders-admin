import { ReservationStatus } from "@prisma/client";

import { countReadyVisibleContracts } from "@/lib/contracts/active-contracts";
import { getReservationPaymentStatus } from "@/lib/reservation-payment-status";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";

type ReadyReservation = {
  status: ReservationStatus;
  formalizedAt: Date | null;
  totalPriceCents: number | null;
  depositCents: number | null;
  quantity: number | null;
  isLicense: boolean;
  service: { category: string | null } | null;
  items: Array<{
    quantity: number | null;
    isExtra: boolean;
    service: { category: string | null } | null;
  }>;
  contracts: Array<{
    unitIndex: number;
    logicalUnitIndex?: number | null;
    status: string;
    supersededAt?: Date | string | null;
    createdAt?: Date | string | null;
  }>;
  payments: Array<{ amountCents: number; isDeposit: boolean; direction: string }>;
};

function euros(cents: number) {
  return `${(Math.max(0, Number(cents ?? 0)) / 100).toFixed(2)} €`;
}

export function evaluateReadyForPlatform(reservation: ReadyReservation) {
  if (reservation.status === ReservationStatus.CANCELED) {
    return { ok: false as const, error: "La reserva está cancelada." };
  }

  if (reservation.status === ReservationStatus.COMPLETED) {
    return { ok: false as const, error: "La reserva está completada." };
  }

  if (!reservation.formalizedAt) {
    return { ok: false as const, error: "La reserva no está formalizada." };
  }

  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: reservation.items ?? [],
  });

  const readyCount = countReadyVisibleContracts(reservation.contracts ?? [], requiredUnits);

  if (requiredUnits > 0 && readyCount < requiredUnits) {
    return {
      ok: false as const,
      error: `Faltan contratos por completar: ${readyCount}/${requiredUnits} listos.`,
      requiredUnits,
      readyCount,
    };
  }

  const paymentStatus = getReservationPaymentStatus({
    totalPriceCents: reservation.totalPriceCents,
    depositCents: reservation.depositCents,
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category,
    items: reservation.items,
    payments: reservation.payments,
  });
  const { pendingServiceCents, pendingDepositCents, fullyPaid } = paymentStatus;

  if (!fullyPaid) {
    const missing: string[] = [];
    if (pendingServiceCents > 0) missing.push(`servicio ${euros(pendingServiceCents)}`);
    if (pendingDepositCents > 0) missing.push(`fianza ${euros(pendingDepositCents)}`);

    return {
      ok: false as const,
      error:
        missing.length > 0
          ? `La reserva no está completamente cobrada. Pendiente: ${missing.join(" y ")}.`
          : "La reserva no está completamente cobrada.",
      requiredUnits,
      readyCount,
      pendingServiceCents,
      pendingDepositCents,
      fullyPaid,
    };
  }

  return {
    ok: true as const,
    requiredUnits,
    readyCount,
    pendingServiceCents,
    pendingDepositCents,
    fullyPaid,
  };
}
