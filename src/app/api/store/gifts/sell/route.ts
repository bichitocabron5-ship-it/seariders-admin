// src/app/api/store/gifts/sell/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { makeGiftCode } from "@/lib/gifts";
import { z } from "zod";
import { PaymentDirection, PaymentMethod, PaymentOrigin } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const Body = z.object({
  productId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CASH"),
  buyerName: z.string().max(120).optional().nullable(),
  buyerPhone: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const { productId, method, buyerName, buyerPhone } = parsed.data;

  const shiftSessionId =
    typeof session === "object" && session !== null && "shiftSessionId" in session
      ? (session as { shiftSessionId?: string | null }).shiftSessionId ?? null
      : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.giftProduct.findUnique({
        where: { id: productId },
        select: { id: true, priceCents: true, isActive: true, validDays: true },
      });
      if (!product || !product.isActive) throw new Error("Producto no existe o no esta activo");

      // 1) Crear Payment (venta del regalo)
      const pay = await tx.payment.create({
        data: {
          origin: PaymentOrigin.STORE,
          method: method as PaymentMethod,
          amountCents: product.priceCents,
          isDeposit: false,
          direction: PaymentDirection.IN,
          createdByUserId: session.userId,
          shiftSessionId,
        },
        select: { id: true },
      });

      // 2) Crear Voucher
      const code = makeGiftCode();
      const expiresAt =
        product.validDays && product.validDays > 0
          ? new Date(Date.now() + product.validDays * 24 * 60 * 60 * 1000)
          : null;

      const voucher = await tx.giftVoucher.create({
        data: {
          code,
          productId: product.id,
          origin: PaymentOrigin.STORE,
          soldByUserId: session.userId,
          soldPaymentId: pay.id,
          expiresAt,
          buyerName: buyerName?.trim() ? buyerName.trim() : null,
          buyerPhone: buyerPhone?.trim() ? buyerPhone.trim() : null,
        },
        select: { id: true, code: true, expiresAt: true },
      });

      return voucher;
    });

    return NextResponse.json({ ok: true, voucher: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}


