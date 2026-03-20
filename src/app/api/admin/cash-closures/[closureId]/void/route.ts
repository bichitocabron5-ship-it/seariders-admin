// src/app/api/admin/cash-closures/[id]/void/route.ts
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
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

const Body = z.object({
  id: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

  const { id, reason } = parsed.data;

  const closure = await prisma.cashClosure.findUnique({
    where: { id },
    select: { id: true, isVoided: true },
  });
  if (!closure) return new NextResponse("Cierre no existe", { status: 404 });
  if (closure.isVoided) return NextResponse.json({ ok: true, id }); // idempotente

  await prisma.cashClosure.update({
    where: { id },
    data: {
      isVoided: true,
      voidedAt: new Date(),
      voidReason: reason,
      voidedByUserId: session.userId,
      // opcional: si quieres que al reabrir quede "no revisado"
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id });
}

