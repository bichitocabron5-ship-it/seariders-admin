import {
  ChannelCommissionLineStatus,
  PaymentDirection,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
  type CommercialValueMode,
  type Prisma,
} from "@prisma/client";

type CommissionSnapshotInput = {
  channelId?: string | null;
  reservationId?: string | null;
  paymentId?: string | null;
  sourceOrigin: PaymentOrigin;
  serviceId?: string | null;
  customerName?: string | null;
  commissionBaseCents?: number | null;
  appliedCommissionMode?: CommercialValueMode | null;
  appliedCommissionValue?: number | null;
  appliedCommissionPct?: number | null;
  appliedCommissionCents?: number | null;
  generatedAt?: Date | null;
};

type CommissionLinePayload = {
  channelId: string;
  reservationId: string | null;
  paymentId: string | null;
  sourceOrigin: PaymentOrigin;
  serviceId: string | null;
  customerName: string | null;
  commissionBaseCents: number;
  appliedCommissionMode: CommercialValueMode;
  appliedCommissionValue: number;
  appliedCommissionPct: number | null;
  commissionCents: number;
  generatedAt: Date;
};

function trimNullable(value?: string | null, maxLength = 160) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function appendNote(existing: string | null | undefined, note: string) {
  const clean = note.trim();
  if (!clean) return existing ?? null;
  const current = String(existing ?? "").trim();
  if (!current) return clean.slice(0, 800);
  if (current.includes(clean)) return current.slice(0, 800);
  return `${current} | ${clean}`.slice(0, 800);
}

function sourceOriginFromReservation(source: ReservationSource): PaymentOrigin {
  if (source === ReservationSource.BOOTH) return PaymentOrigin.BOOTH;
  if (source === ReservationSource.WEB) return PaymentOrigin.WEB;
  return PaymentOrigin.STORE;
}

export function buildChannelCommissionLinePayload(
  input: CommissionSnapshotInput
): CommissionLinePayload | null {
  const channelId = trimNullable(input.channelId);
  const commissionCents = Math.max(0, Number(input.appliedCommissionCents ?? 0));

  if (!channelId || commissionCents <= 0) return null;

  return {
    channelId,
    reservationId: trimNullable(input.reservationId),
    paymentId: trimNullable(input.paymentId),
    sourceOrigin: input.sourceOrigin,
    serviceId: trimNullable(input.serviceId),
    customerName: trimNullable(input.customerName),
    commissionBaseCents: Math.max(0, Number(input.commissionBaseCents ?? 0)),
    appliedCommissionMode: input.appliedCommissionMode ?? "PERCENT",
    appliedCommissionValue: Number(input.appliedCommissionValue ?? 0),
    appliedCommissionPct: input.appliedCommissionPct == null ? null : Number(input.appliedCommissionPct),
    commissionCents,
    generatedAt: input.generatedAt ?? new Date(),
  };
}

async function updateExistingPendingLine(
  tx: Prisma.TransactionClient,
  id: string,
  existing: { status: ChannelCommissionLineStatus; paymentId: string | null },
  payload: CommissionLinePayload
) {
  if (existing.status !== ChannelCommissionLineStatus.PENDING) return null;

  return tx.channelCommissionLine.update({
    where: { id },
    data: {
      paymentId: existing.paymentId ?? payload.paymentId,
      sourceOrigin: payload.sourceOrigin,
      customerName: payload.customerName,
      commissionBaseCents: payload.commissionBaseCents,
      appliedCommissionMode: payload.appliedCommissionMode,
      appliedCommissionValue: payload.appliedCommissionValue,
      appliedCommissionPct: payload.appliedCommissionPct,
      commissionCents: payload.commissionCents,
      generatedAt: payload.generatedAt,
    },
  });
}

async function createCommissionLine(
  tx: Prisma.TransactionClient,
  payload: CommissionLinePayload
) {
  return tx.channelCommissionLine.create({
    data: {
      channelId: payload.channelId,
      reservationId: payload.reservationId,
      paymentId: payload.paymentId,
      sourceOrigin: payload.sourceOrigin,
      serviceId: payload.serviceId,
      customerName: payload.customerName,
      commissionBaseCents: payload.commissionBaseCents,
      appliedCommissionMode: payload.appliedCommissionMode,
      appliedCommissionValue: payload.appliedCommissionValue,
      appliedCommissionPct: payload.appliedCommissionPct,
      commissionCents: payload.commissionCents,
      generatedAt: payload.generatedAt,
      status: ChannelCommissionLineStatus.PENDING,
    },
  });
}

async function upsertReservationCommissionLine(
  tx: Prisma.TransactionClient,
  payload: CommissionLinePayload
) {
  if (!payload.reservationId || !payload.serviceId) return null;

  const existing = await tx.channelCommissionLine.findUnique({
    where: {
      reservationId_channelId_serviceId: {
        reservationId: payload.reservationId,
        channelId: payload.channelId,
        serviceId: payload.serviceId,
      },
    },
    select: { id: true, status: true, paymentId: true },
  });

  if (existing) {
    return updateExistingPendingLine(tx, existing.id, existing, payload);
  }

  return createCommissionLine(tx, payload);
}

async function upsertPaymentCommissionLine(
  tx: Prisma.TransactionClient,
  payload: CommissionLinePayload
) {
  if (!payload.paymentId) return null;

  const existing = await tx.channelCommissionLine.findUnique({
    where: { paymentId: payload.paymentId },
    select: { id: true, status: true, paymentId: true },
  });

  if (existing) {
    return updateExistingPendingLine(tx, existing.id, existing, payload);
  }

  return createCommissionLine(tx, payload);
}

export async function voidPendingChannelCommissionLinesForReservationTx(
  tx: Prisma.TransactionClient,
  reservationId: string,
  reason = "Reservation canceled"
) {
  const lines = await tx.channelCommissionLine.findMany({
    where: {
      reservationId,
      status: ChannelCommissionLineStatus.PENDING,
    },
    select: { id: true, notes: true },
  });

  for (const line of lines) {
    await tx.channelCommissionLine.update({
      where: { id: line.id },
      data: {
        status: ChannelCommissionLineStatus.VOIDED,
        notes: appendNote(line.notes, reason),
      },
    });
  }

  return { voided: lines.length };
}

export async function voidPendingChannelCommissionLineForPaymentTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
  reason = "Payment reversed"
) {
  const line = await tx.channelCommissionLine.findUnique({
    where: { paymentId },
    select: { id: true, status: true, notes: true },
  });

  if (!line || line.status !== ChannelCommissionLineStatus.PENDING) {
    return { voided: 0 };
  }

  await tx.channelCommissionLine.update({
    where: { id: line.id },
    data: {
      status: ChannelCommissionLineStatus.VOIDED,
      notes: appendNote(line.notes, reason),
    },
  });

  return { voided: 1 };
}

export async function syncChannelCommissionLineFromReservationTx(
  tx: Prisma.TransactionClient,
  reservationId: string
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      source: true,
      status: true,
      channelId: true,
      serviceId: true,
      customerName: true,
      commissionBaseCents: true,
      appliedCommissionMode: true,
      appliedCommissionValue: true,
      appliedCommissionPct: true,
      appliedCommissionCents: true,
      createdAt: true,
    },
  });

  if (!reservation) return null;

  if (reservation.status === ReservationStatus.CANCELED) {
    await voidPendingChannelCommissionLinesForReservationTx(tx, reservation.id);
    return null;
  }

  const payload = buildChannelCommissionLinePayload({
    channelId: reservation.channelId,
    reservationId: reservation.id,
    paymentId: null,
    sourceOrigin: sourceOriginFromReservation(reservation.source),
    serviceId: reservation.serviceId,
    customerName: reservation.customerName,
    commissionBaseCents: reservation.commissionBaseCents,
    appliedCommissionMode: reservation.appliedCommissionMode,
    appliedCommissionValue: reservation.appliedCommissionValue,
    appliedCommissionPct: reservation.appliedCommissionPct,
    appliedCommissionCents: reservation.appliedCommissionCents,
    generatedAt: reservation.createdAt,
  });

  if (!payload) {
    await voidPendingChannelCommissionLinesForReservationTx(
      tx,
      reservation.id,
      "Commission snapshot no longer payable"
    );
    return null;
  }

  return upsertReservationCommissionLine(tx, payload);
}

export async function syncChannelCommissionLineFromPaymentTx(
  tx: Prisma.TransactionClient,
  paymentId: string
) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      reservationId: true,
      serviceId: true,
      channelId: true,
      origin: true,
      direction: true,
      reversalOfPaymentId: true,
      customerName: true,
      commissionBaseCents: true,
      appliedCommissionMode: true,
      appliedCommissionValue: true,
      appliedCommissionPct: true,
      appliedCommissionCents: true,
      createdAt: true,
      reservation: {
        select: {
          id: true,
          status: true,
          channelId: true,
          serviceId: true,
          customerName: true,
        },
      },
    },
  });

  if (!payment) return null;

  if (payment.direction === PaymentDirection.OUT) {
    if (payment.reversalOfPaymentId) {
      await voidPendingChannelCommissionLineForPaymentTx(
        tx,
        payment.reversalOfPaymentId,
        `Reversed by payment ${payment.id}`
      );
    }
    return null;
  }

  if (payment.reservation?.status === ReservationStatus.CANCELED) {
    await voidPendingChannelCommissionLinesForReservationTx(tx, payment.reservation.id);
    return null;
  }

  const payload = buildChannelCommissionLinePayload({
    channelId: payment.channelId ?? payment.reservation?.channelId ?? null,
    reservationId: payment.reservationId,
    paymentId: payment.id,
    sourceOrigin: payment.origin,
    serviceId: payment.serviceId ?? payment.reservation?.serviceId ?? null,
    customerName: payment.customerName ?? payment.reservation?.customerName ?? null,
    commissionBaseCents: payment.commissionBaseCents,
    appliedCommissionMode: payment.appliedCommissionMode,
    appliedCommissionValue: payment.appliedCommissionValue,
    appliedCommissionPct: payment.appliedCommissionPct,
    appliedCommissionCents: payment.appliedCommissionCents,
    generatedAt: payment.createdAt,
  });

  if (!payload) return null;

  if (payload.reservationId) {
    return upsertReservationCommissionLine(tx, payload);
  }

  return upsertPaymentCommissionLine(tx, payload);
}
