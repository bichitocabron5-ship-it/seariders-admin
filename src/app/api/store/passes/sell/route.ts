// src/app/api/store/passes/sell/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentDirection, PaymentMethod, PaymentOrigin } from "@prisma/client";
import { makePassCode } from "@/lib/passes";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const NullableStr = z.string().optional().nullable();

const Body = z.object({
  productId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]).default("CASH"),

  buyerName: z.string().max(120).optional().nullable(),
  buyerPhone: z.string().max(40).optional().nullable(),
  buyerEmail: z.string().max(160).optional().nullable(),

  // PRO contrato (se guardan en el bono)
  customerCountry: NullableStr,   // "ES"
  customerAddress: NullableStr,
  customerDocType: NullableStr,
  customerDocNumber: NullableStr,
});

// helper pequeño (mismo patrón que ya usas)
const norm = (v: unknown) => {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
};

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { productId, method, buyerName, buyerPhone, buyerEmail, customerCountry, customerAddress, customerDocType, customerDocNumber } = parsed.data;
  const shiftSessionId = (session as AppSession & { shiftSessionId?: string | null }).shiftSessionId ?? null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.passProduct.findUnique({
        where: { id: productId },
        select: {
          id: true,
          isActive: true,
          validDays: true,
          totalMinutes: true,
          priceCents: true,
        },
      });
      if (!product || !product.isActive) throw new Error("Producto no existe o no está activo");

      // 1) Payment (venta del bono)
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

      // 2) Voucher
      const expiresAt =
        product.validDays && product.validDays > 0
          ? new Date(Date.now() + product.validDays * 24 * 60 * 60 * 1000)
          : null;

      // Generar código (si hay choque, reintenta unas veces)
      let lastErr: unknown = null;
      for (let i = 0; i < 5; i++) {
        const code = makePassCode();
        try {
          const voucher = await tx.passVoucher.create({
            data: {
              code,
              productId: product.id,
              origin: PaymentOrigin.STORE,
              soldByUserId: session.userId,
              soldPaymentId: pay.id,
              expiresAt,

              buyerName: norm(buyerName),
              buyerPhone: norm(buyerPhone),
              buyerEmail: norm(buyerEmail),

              // PRO: guardar contrato
              customerCountry: norm(customerCountry)?.toUpperCase() ?? null,
              customerAddress: norm(customerAddress),
              customerDocType: norm(customerDocType),
              customerDocNumber: norm(customerDocNumber),

              minutesTotal: product.totalMinutes,
              minutesRemaining: product.totalMinutes,
            },
            select: {
              id: true,
              code: true,
              expiresAt: true,
              minutesTotal: true,
              minutesRemaining: true,
            },
          });

          return voucher;
        } catch (e: unknown) {
          lastErr = e;
          // Unique constraint => reintentar
          const msg = e instanceof Error ? e.message : String(e ?? "");
          if (msg.includes("Unique") || msg.includes("unique") || msg.includes("P2002")) continue;
          throw e;
        }
      }

      throw new Error(lastErr instanceof Error ? lastErr.message : "No se pudo generar código único");
    });

    return NextResponse.json({ ok: true, voucher: result });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

