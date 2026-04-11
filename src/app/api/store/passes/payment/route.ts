import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentDirection, PaymentMethod, PaymentOrigin } from "@prisma/client";
import { z } from "zod";
import { getPassVoucherPaidCents, getPassVoucherPendingCents } from "@/lib/pass-vouchers";

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
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]),
  amountCents: z.number().int().positive(),
});

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const shiftSessionId = (session as AppSession & { shiftSessionId?: string | null }).shiftSessionId ?? null;
  const code = parsed.data.code.trim().toUpperCase();

  try {
    const out = await prisma.$transaction(async (tx) => {
      const voucher = await tx.passVoucher.findUnique({
        where: { code },
        select: {
          id: true,
          isVoided: true,
          salePriceCents: true,
          soldPayment: { select: { amountCents: true, direction: true } },
          salePayments: { select: { amountCents: true, direction: true } },
        },
      });

      if (!voucher) throw new Error("Bono no existe");
      if (voucher.isVoided) throw new Error("No se puede cobrar un bono anulado");

      const paidCents = getPassVoucherPaidCents(voucher);
      const pendingCents = getPassVoucherPendingCents(voucher.salePriceCents, paidCents);
      if (pendingCents <= 0) throw new Error("Este bono ya está totalmente pagado");
      if (parsed.data.amountCents > pendingCents) {
        throw new Error(`El importe supera lo pendiente (${pendingCents} céntimos)`);
      }

      await tx.payment.create({
        data: {
          origin: PaymentOrigin.STORE,
          method: parsed.data.method as PaymentMethod,
          amountCents: parsed.data.amountCents,
          isDeposit: false,
          direction: PaymentDirection.IN,
          createdByUserId: session.userId,
          shiftSessionId,
          passVoucherSaleId: voucher.id,
        },
        select: { id: true },
      });

      const nextPaidCents = paidCents + parsed.data.amountCents;
      return {
        ok: true,
        paidCents: nextPaidCents,
        pendingCents: getPassVoucherPendingCents(voucher.salePriceCents, nextPaidCents),
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}
