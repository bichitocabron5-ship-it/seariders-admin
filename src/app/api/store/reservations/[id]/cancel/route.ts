import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ExtraTimeStatus,
  MonitorRunStatus,
  PaymentMethod,
  PaymentOrigin,
  ReservationSource,
  ReservationStatus,
  RoleName,
  RunAssignmentStatus,
  type Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import {
  CommercialAdjustmentCommitBlockedError,
  commitCommercialAdjustment,
} from "@/lib/commercial-adjustment-commit";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { getRequestOperationalContext, writeOperationalLog } from "@/lib/operational-log";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";
import { refundSelectionForStoreCancel } from "@/lib/store-cancel-refund-mode";

export const runtime = "nodejs";

const Body = z.object({
  refundMode: z.enum(["NONE", "SERVICE", "FULL"]).optional(),
  requestedRefundMode: z.enum(["refundNow", "leavePendingRefund", "none"]).optional(),
  refundScope: z.enum(["SERVICE", "DEPOSIT", "FULL"]).optional(),
  refundMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  refundOrigin: z.nativeEnum(PaymentOrigin).default(PaymentOrigin.STORE),
  reason: z.string().max(500).optional().nullable(),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role !== "STORE" && session.role !== "ADMIN") return null;
  return session;
}

function normalizeCancelReason(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text.slice(0, 500) : null;
}

async function assertStoreCancellationOperationalStateTx(
  tx: Prisma.TransactionClient,
  reservationId: string
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      source: true,
      arrivedStoreAt: true,
    },
  });

  if (!reservation) {
    throw Object.assign(new Error("Reserva no existe"), { status: 404 });
  }

  if (reservation.source === ReservationSource.BOOTH && !reservation.arrivedStoreAt) {
    throw Object.assign(
      new Error("La reserva sigue en carpa. Cancelala desde BOOTH para no afectar la caja de STORE."),
      { status: 409 }
    );
  }

  const activeAssignments = await tx.monitorRunAssignment.count({
    where: {
      reservationId,
      status: RunAssignmentStatus.ACTIVE,
      run: {
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
      },
    },
  });

  if (activeAssignments > 0) {
    throw Object.assign(
      new Error("La reserva esta activa en plataforma. Cierrala o desasignala antes de cancelarla."),
      { status: 409 }
    );
  }

  const queuedAssignments = await tx.monitorRunAssignment.findMany({
    where: {
      reservationId,
      status: RunAssignmentStatus.QUEUED,
      run: {
        status: { in: [MonitorRunStatus.READY, MonitorRunStatus.IN_SEA] },
      },
    },
    select: { id: true },
  });

  if (queuedAssignments.length > 0) {
    await tx.monitorRunAssignment.deleteMany({
      where: { id: { in: queuedAssignments.map((assignment) => assignment.id) } },
    });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const requestContext = getRequestOperationalContext(req);
  const auditSource = session.role === "ADMIN" ? "ADMIN" : "STORE";

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const body = parsed.data;
  const actorUserId = session.userId as string;
  const refundSelection = refundSelectionForStoreCancel(body);
  const { requestedRefundMode, refundScope } = refundSelection;
  const reason = normalizeCancelReason(body.reason);

  try {
    const current = await prisma.reservation.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!current) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });
    if (current.status === ReservationStatus.CANCELED) {
      return NextResponse.json({
        ok: true,
        alreadyCanceled: true,
        refundedServiceCents: 0,
        refundedDepositCents: 0,
        refundNowCents: 0,
        pendingRefundCents: 0,
      });
    }

    const refundShiftSession =
      requestedRefundMode === "refundNow"
        ? await findCurrentShiftSession({
            userId: actorUserId,
            role: session.role as RoleName,
            shiftSessionId: session.shiftSessionId,
          })
        : null;

    const result = await commitCommercialAdjustment(
      prisma,
      id,
      {
        newTotalCents: 0,
        newDepositCents: 0,
        operationType: "CANCEL",
        requestedRefundMode,
        refundScope,
        reason,
      },
      {
        actorUserId,
        refundMethod: body.refundMethod,
        refundOrigin: body.refundOrigin,
        refundShiftSessionId: refundShiftSession?.id ?? null,
        assertRefundCashOpen:
          requestedRefundMode === "refundNow"
            ? () => assertCashOpenForUser(actorUserId, session.role as RoleName, session.shiftSessionId)
            : undefined,
        beforeMutationTx: async (tx) => {
          await assertStoreCancellationOperationalStateTx(tx, id);
        },
        afterMutationTx: async (tx, context) => {
          await tx.extraTimeEvent.updateMany({
            where: {
              reservationId: id,
              status: ExtraTimeStatus.PENDING,
            },
            data: { status: ExtraTimeStatus.VOIDED },
          });

          await syncStoreFulfillmentTasksForReservation(tx, id);

          await writeOperationalLog(
            {
              action: "RESERVATION_CANCEL",
              entityType: "RESERVATION",
              entityId: id,
              source: auditSource,
              actor: { userId: session.userId },
              request: requestContext,
              metadata: {
                reservationSource: context.reservation.source,
                statusBefore: context.reservation.status,
                requestedRefundMode,
                refundScope,
                refundMethod: body.refundMethod,
                refundOrigin: body.refundOrigin,
                refundNowCents: context.resultEvaluation.refundNowCents,
                pendingRefundCents: context.resultEvaluation.pendingRefundCents,
                paidServiceCents: context.evaluation.paidServiceCents,
                paidDepositCents: context.evaluation.paidDepositCents,
                refundableServiceCents: context.evaluation.refundableServiceCents,
                refundableDepositCents: context.evaluation.refundableDepositCents,
                refundedServiceCents: context.resultEvaluation.serviceRefundNowCents,
                refundedDepositCents: context.resultEvaluation.depositRefundNowCents,
                depositRefundHeldCents: context.resultEvaluation.depositRefundHeldCents,
                depositRefundBlockedReason: context.resultEvaluation.depositRefundBlockedReason,
              },
            },
            tx
          );
        },
      }
    );

    if (!result) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });

    return NextResponse.json({
      ...result,
      alreadyCanceled: false,
      refundedServiceCents: result.serviceRefundNowCents,
      refundedDepositCents: result.depositRefundNowCents,
    });
  } catch (error: unknown) {
    if (error instanceof CommercialAdjustmentCommitBlockedError) {
      return NextResponse.json(
        {
          error: error.message,
          blockers: error.blockers,
          summary: error.summary,
        },
        { status: error.status }
      );
    }

    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 400;

    const message = error instanceof Error ? error.message : "No se pudo cancelar la reserva";
    return NextResponse.json({ error: message }, { status });
  }
}
