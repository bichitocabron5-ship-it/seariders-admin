// src/app/api/admin/gifts/vouchers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentOrigin } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

function makeCode() {
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(100 + Math.random() * 900);
  return `RG-${a}-${b}`;
}

const CreateBody = z.object({
  productId: z.string().min(1),
  origin: z.nativeEnum(PaymentOrigin),
  forceCode: z.string().min(6).max(20).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.giftVoucher.findMany({
    orderBy: [{ soldAt: "desc" }],
    take: 200,
    include: {
      product: { select: { id: true, name: true, priceCents: true } },
      soldByUser: { select: { username: true, fullName: true } },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const { productId, origin, forceCode, expiresInDays } = parsed.data;

  const product = await prisma.giftProduct.findUnique({ where: { id: productId }, select: { id: true, validDays: true } });
  if (!product) return NextResponse.json({ error: "Producto no existe" }, { status: 400 });

  // prioridad: expiresInDays (admin) > product.validDays > null
  const days = expiresInDays ?? product.validDays ?? null;
  const expiresAt = days ? new Date(Date.now() + days * 24 * 3600 * 1000) : null;

  // intentamos generar codigo hasta que no colisione (muy raro, pero seguro)
  let code = (forceCode?.trim() || makeCode()).toUpperCase();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.giftVoucher.findUnique({ where: { code } });
    if (!exists) break;
    code = makeCode();
  }

  const created = await prisma.giftVoucher.create({
    data: {
      code,
      productId,
      origin,
      soldByUserId: session.userId,
      expiresAt,
    },
    select: { id: true, code: true },
  });

  return NextResponse.json({ ok: true, created });
}


