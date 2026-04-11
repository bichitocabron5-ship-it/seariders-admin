import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentDirection, PaymentMethod, PaymentOrigin, RoleName } from "@prisma/client";
import { getPassVoucherPaidCents } from "@/lib/pass-vouchers";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const Body = z.object({
  code: z.string().min(3),
  reason: z.string().trim().min(3).max(500),
  refund: z.boolean().default(false),
  refundMethod: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CARD"),
});

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  await assertCashOpenForUser(session.userId!, session.role as RoleName);

  const shiftSessionId = (session as AppSession & { shiftSessionId?: string | null }).shiftSessionId ?? null;
  const code = parsed.data.code.trim().toUpperCase();

  try {
    const out = await prisma.$transaction(async (tx) => {
      const voucher = await tx.passVoucher.findUnique({
        where: { code },
        select: {
          id: true,
          isVoided: true,
          soldPayment: { select: { amountCents: true, direction: true } },
          salePayments: { select: { amountCents: true, direction: true } },
          consumes: { select: { id: true }, take: 1 },
        },
      });

      if (!voucher) throw new Error("Bono no existe");
      if (voucher.isVoided) return { ok: true, refundedCents: 0 };
      if ((voucher.consumes ?? []).length > 0) {
        throw new Error("No se puede anular un bono que ya tiene consumos");
      }

      const refundableCents = getPassVoucherPaidCents(voucher);

      await tx.passVoucher.update({
        where: { id: voucher.id },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidReason: parsed.data.reason,
        },
        select: { id: true },
      });

      if (parsed.data.refund && refundableCents > 0) {
        await tx.payment.create({
          data: {
            origin: PaymentOrigin.STORE,
            method: parsed.data.refundMethod as PaymentMethod,
            amountCents: refundableCents,
            isDeposit: false,
            direction: PaymentDirection.OUT,
            createdByUserId: session.userId,
            shiftSessionId,
            passVoucherSaleId: voucher.id,
          },
          select: { id: true },
        });
      }

      return {
        ok: true,
        refundedCents: parsed.data.refund ? refundableCents : 0,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}
