import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { PaymentMethod, PaymentOrigin, RoleName } from "@prisma/client";

import {
  CommercialAdjustmentCommitBlockedError,
  commitCommercialAdjustment,
} from "@/lib/commercial-adjustment-commit";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { findCurrentShiftSession } from "@/lib/shiftSessions";
import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

const Body = z.object({
  newTotalCents: z.number().int().min(0),
  newDepositCents: z.number().int().min(0).optional().nullable(),
  operationType: z.enum(["EDIT", "CANCEL"]),
  requestedRefundMode: z.enum(["refundNow", "leavePendingRefund", "none"]).default("none"),
  refundMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  refundOrigin: z.nativeEnum(PaymentOrigin).default(PaymentOrigin.STORE),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  try {
    const actorUserId = session.userId as string;
    const refundShiftSession =
      parsed.data.requestedRefundMode === "refundNow"
        ? await findCurrentShiftSession({
            userId: actorUserId,
            role: session.role as RoleName,
            shiftSessionId: session.shiftSessionId,
          })
        : null;

    const result = await commitCommercialAdjustment(prisma, id, parsed.data, {
      actorUserId,
      refundMethod: parsed.data.refundMethod,
      refundOrigin: parsed.data.refundOrigin,
      refundShiftSessionId: refundShiftSession?.id ?? null,
      assertRefundCashOpen:
        parsed.data.requestedRefundMode === "refundNow"
          ? () => assertCashOpenForUser(actorUserId, session.role as RoleName, session.shiftSessionId)
          : undefined,
    });

    if (!result) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });

    return NextResponse.json(result);
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

    const message = error instanceof Error ? error.message : "No se pudo aplicar el ajuste comercial";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
