import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createPassPortalToken } from "@/lib/passes/public-pass-link";
import { normalizePhoneForWhatsApp } from "@/lib/notifications/whatsapp";

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

function resolvePublicBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("Falta NEXT_PUBLIC_APP_URL para generar enlaces publicos");
  return configured.replace(/\/+$/, "");
}

function buildPassConsumptionMessage(args: {
  recipientName: string;
  code: string;
  minutesTotal: number;
  minutesUsed: number;
  minutesRemaining: number;
  portalUrl: string;
}) {
  const consumed = Math.max(0, Number(args.minutesTotal) - Number(args.minutesRemaining));
  return [
    `Hola ${args.recipientName}, tu bono ${args.code} ha registrado un consumo.`,
    `Contratadas: ${args.minutesTotal} min`,
    `Gastadas acumuladas: ${consumed} min`,
    `Gastadas en este uso: ${args.minutesUsed} min`,
    `Pendientes: ${args.minutesRemaining} min`,
    `Detalle e historial: ${args.portalUrl}`,
  ].join("\n");
}

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
  if (!latestConsume) return new NextResponse("El bono no tiene consumos para compartir", { status: 400 });

  const token = createPassPortalToken({ voucherId: voucher.id });
  const portalUrl = `${resolvePublicBaseUrl()}/passes/${encodeURIComponent(token)}`;
  const recipientName = voucher.buyerName?.trim() || "cliente";
  const recipientPhone = normalizePhoneForWhatsApp(voucher.buyerPhone, voucher.customerCountry);
  const message = buildPassConsumptionMessage({
    recipientName,
    code: voucher.code,
    minutesTotal: voucher.minutesTotal,
    minutesUsed: latestConsume.minutesUsed,
    minutesRemaining: voucher.minutesRemaining,
    portalUrl,
  });

  return NextResponse.json({
    ok: true,
    share: {
      recipientName,
      recipientPhone,
      country: voucher.customerCountry,
      portalUrl,
      message,
    },
  });
}
