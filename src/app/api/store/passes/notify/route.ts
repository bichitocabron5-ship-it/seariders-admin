import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { sendPassConsumptionWhatsapp } from "@/lib/passes/pass-notifications";

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
});

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse("Body invalido", { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();

  const voucher = await prisma.passVoucher.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      minutesTotal: true,
      minutesRemaining: true,
      buyerName: true,
      buyerPhone: true,
      customerCountry: true,
      consumes: {
        orderBy: { consumedAt: "desc" },
        take: 1,
        select: {
          id: true,
          minutesUsed: true,
        },
      },
    },
  });

  if (!voucher) return new NextResponse("Bono no existe", { status: 404 });
  const latestConsume = voucher.consumes[0];
  if (!latestConsume) return new NextResponse("El bono no tiene consumos para notificar", { status: 400 });

  const notification = await sendPassConsumptionWhatsapp({
    voucherId: voucher.id,
    consumeId: latestConsume.id,
    code: voucher.code,
    minutesTotal: voucher.minutesTotal,
    minutesUsed: latestConsume.minutesUsed,
    minutesRemaining: voucher.minutesRemaining,
    buyerName: voucher.buyerName,
    buyerPhone: voucher.buyerPhone,
    customerCountry: voucher.customerCountry,
  }).catch((error: unknown) => ({
    ok: false as const,
    status: "FAILED",
    error: error instanceof Error ? error.message : "Error reenviando WhatsApp del bono",
  }));

  return NextResponse.json({ ok: true, notification });
}
