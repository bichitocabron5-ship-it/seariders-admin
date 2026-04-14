import { ReservationStatus } from "@prisma/client";

import { countReadyVisibleContracts } from "@/lib/contracts/active-contracts";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";
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
  contracts: Array<{ unitIndex: number; logicalUnitIndex?: number | null; status: string; supersededAt?: Date | string | null; createdAt?: Date | string | null }>;
  payments: Array<{ amountCents: number; isDeposit: boolean; direction: string }>;
};

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

  const servicePaidCents = (reservation.payments ?? [])
    .filter((payment) => !payment.isDeposit)
    .reduce((sum, payment) => sum + (payment.direction === "OUT" ? -1 : 1) * Number(payment.amountCents ?? 0), 0);

  const depositPaidCents = (reservation.payments ?? [])
    .filter((payment) => payment.isDeposit)
    .reduce((sum, payment) => sum + (payment.direction === "OUT" ? -1 : 1) * Number(payment.amountCents ?? 0), 0);

  const serviceDueCents = Number(reservation.totalPriceCents ?? 0);
  const depositDueCents = computeReservationDepositCents({
    storedDepositCents: reservation.depositCents,
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: reservation.items ?? [],
  });

  const pendingServiceCents = Math.max(0, serviceDueCents - servicePaidCents);
  const pendingDepositCents = Math.max(0, depositDueCents - depositPaidCents);
  const fullyPaid = pendingServiceCents === 0 && pendingDepositCents === 0;

  if (!fullyPaid) {
    return {
      ok: false as const,
      error: "La reserva no está completamente cobrada.",
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
