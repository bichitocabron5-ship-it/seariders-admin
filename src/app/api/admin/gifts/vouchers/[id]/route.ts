// src/app/api/admin/gifts/vouchers/[id]/void/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

const Body = z.object({ reason: z.string().min(3).max(200) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invÃ¡lido" }, { status: 400 });

  const v = await prisma.giftVoucher.findUnique({
    where: { id },
    select: { id: true, isVoided: true, redeemedAt: true },
  });
  if (!v) return NextResponse.json({ error: "Vale no existe" }, { status: 404 });
  if (v.redeemedAt) return NextResponse.json({ error: "No se puede anular: ya estÃ¡ canjeado." }, { status: 400 });
  if (v.isVoided) return NextResponse.json({ ok: true }); // idempotente

  await prisma.giftVoucher.update({
    where: { id },
    data: {
      isVoided: true,
      voidedAt: new Date(),
      voidReason: parsed.data.reason.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}

