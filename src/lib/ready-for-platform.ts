import { ReservationStatus } from "@prisma/client";

import { countReadyVisibleContractsByTargets } from "@/lib/contracts/active-contracts";
import { getReservationPaymentStatus } from "@/lib/reservation-payment-status";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";

type ReadyReservation = {
  status: ReservationStatus;
  formalizedAt: Date | null;
  giftVoucherId?: string | null;
  passVoucherId?: string | null;
  passConsumeId?: string | null;
  totalPriceCents: number | null;
  depositCents: number | null;
  quantity: number | null;
  serviceId?: string | null;
  optionId?: string | null;
  pax?: number | null;
  isLicense: boolean;
  service: { name?: string | null; category: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
  items: Array<{
    id?: string | null;
    serviceId?: string | null;
    optionId?: string | null;
    quantity: number | null;
    pax?: number | null;
    isExtra: boolean;
    totalPriceCents?: number | null;
    service: { name?: string | null; category: string | null } | null;
    option?: { durationMinutes?: number | null } | null;
  }>;
  contracts: Array<{
    id?: string | null;
    reservationItemId?: string | null;
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

  const contractRequirements = buildReservationContractRequirements({
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    serviceId: reservation.serviceId ?? null,
    optionId: reservation.optionId ?? null,
    serviceName: reservation.service?.name ?? null,
    durationMinutes: reservation.option?.durationMinutes ?? null,
    pax: reservation.pax ?? null,
    totalPriceCents: reservation.totalPriceCents,
    items: reservation.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const requiredUnits = contractRequirements.length;

  const readyCount = countReadyVisibleContractsByTargets(reservation.contracts ?? [], syncTargets);

  if (requiredUnits > 0 && readyCount < requiredUnits) {
    return {
      ok: false as const,
      error: `Faltan contratos por completar: ${readyCount}/${requiredUnits} listos.`,
      requiredUnits,
      readyCount,
    };
  }

  const paymentStatus = getReservationPaymentStatus({
    giftVoucherId: reservation.giftVoucherId,
    passVoucherId: reservation.passVoucherId,
    passConsumeId: reservation.passConsumeId,
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
