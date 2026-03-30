import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;

  return null;
}

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const codeRaw = searchParams.get("code");

  if (!codeRaw || codeRaw.trim().length < 3) {
    return new NextResponse("Código inválido", { status: 400 });
  }

  const code = codeRaw.trim().toUpperCase();

  try {
    const voucher = await prisma.passVoucher.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        isVoided: true,
        voidedAt: true,
        voidReason: true,
        expiresAt: true,
        minutesTotal: true,
        minutesRemaining: true,
        soldAt: true,
        buyerName: true,
        buyerPhone: true,
        buyerEmail: true,
        product: {
          select: {
            id: true,
            name: true,
            totalMinutes: true,
            priceCents: true,
            service: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!voucher) {
      return new NextResponse("Código no existe", { status: 404 });
    }

    const now = new Date();

    const isExpired =
      voucher.expiresAt
        ? new Date(voucher.expiresAt).getTime() < now.getTime()
        : false;

    const isExhausted = Number(voucher.minutesRemaining ?? 0) <= 0;

    return NextResponse.json({
      ok: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,

        status: {
          isVoided: voucher.isVoided,
          isExpired,
          isExhausted
        },

        minutesTotal: voucher.minutesTotal,
        minutesRemaining: voucher.minutesRemaining,

        expiresAt: voucher.expiresAt,
        soldAt: voucher.soldAt,

        buyerName: voucher.buyerName,
        buyerPhone: voucher.buyerPhone,
        buyerEmail: voucher.buyerEmail,

        product: {
          id: voucher.product.id,
          name: voucher.product.name,
          totalMinutes: voucher.product.totalMinutes,
          priceCents: voucher.product.priceCents,
          serviceId: voucher.product.service.id,
          serviceName: voucher.product.service.name
        }
      }
    });

  } catch (e: unknown) {
    console.error("Pass by-code error:", e);
    return new NextResponse(e instanceof Error ? e.message : "Error interno", { status: 500 });
  }
}

