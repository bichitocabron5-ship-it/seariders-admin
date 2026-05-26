// src/app/api/admin/cash-closures/[closureId]/void/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { getRequestOperationalContext, writeOperationalLog } from "@/lib/operational-log";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

const Body = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ closureId: string }> | { closureId: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const requestContext = getRequestOperationalContext(req);

  const rawParams = await ctx.params;
  const closureId = typeof rawParams?.closureId === "string" ? rawParams.closureId.trim() : "";
  if (!closureId) return new NextResponse("Datos inválidos", { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const { reason } = parsed.data;

  const closure = await prisma.cashClosure.findUnique({
    where: { id: closureId },
    select: { id: true, isVoided: true, origin: true, shift: true, businessDate: true },
  });
  if (!closure) return new NextResponse("Cierre no existe", { status: 404 });
  if (closure.isVoided) return NextResponse.json({ ok: true, id: closureId }); // idempotente

  await prisma.$transaction(async (tx) => {
    await tx.cashClosure.update({
      where: { id: closureId },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidReason: reason,
        voidedByUserId: session.userId,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
      },
      select: { id: true },
    });

    await writeOperationalLog(
      {
        action: "CASH_CLOSURE_VOID",
        entityType: "CASH_CLOSURE",
        entityId: closureId,
        source: "ADMIN",
        actor: { userId: session.userId },
        request: requestContext,
        metadata: {
          origin: closure.origin,
          shift: closure.shift,
          businessDate: closure.businessDate.toISOString(),
          reason,
        },
      },
      tx
    );
  });

  return NextResponse.json({ ok: true, id: closureId });
}
