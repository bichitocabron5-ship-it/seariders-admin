import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";
import { applyPlatformExtraEventsTx } from "@/lib/reservation-platform-extras";

export const runtime = "nodejs";

const Body = z.object({
  dryRun: z.boolean().optional().default(false),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  return session.role === "ADMIN" || session.role === "STORE" ? session : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: reservationId } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  try {
    if (parsed.data.dryRun) {
      const pending = await prisma.extraTimeEvent.findMany({
        where: { reservationId, status: "PENDING" },
        select: { id: true },
      });
      return NextResponse.json({
        ok: true,
        reservationId,
        dryRun: true,
        applied: pending.length,
        createdItems: [],
      });
    }

    const out = await prisma.$transaction((tx) => applyPlatformExtraEventsTx(tx, reservationId));
    return NextResponse.json(out);
  } catch (error: unknown) {
    return new NextResponse(error instanceof Error ? error.message : "Error", { status: 400 });
  }
}
