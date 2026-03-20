// src/app/api/store/reservations/[id]/pending-platform-extras/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ExtraTimeStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: reservationId } = await ctx.params;

  try {
    const rows = await prisma.extraTimeEvent.findMany({
      where: { reservationId, status: ExtraTimeStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        serviceCode: true,
        extraMinutes: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, { qty: number; minutes: number }>();
    for (const r of rows) {
      const code = String(r.serviceCode);
      const cur = grouped.get(code) ?? { qty: 0, minutes: 0 };
      cur.qty += 1;
      cur.minutes += Number(r.extraMinutes ?? 0);
      grouped.set(code, cur);
    }

    const items = Array.from(grouped.entries()).map(([serviceCode, v]) => ({
      serviceCode,
      quantity: v.qty,
      minutesTotal: v.minutes,
    }));

    return NextResponse.json({
      ok: true,
      reservationId,
      pendingCount: rows.length,
      minutesTotal: rows.reduce((sum, r) => sum + Number(r.extraMinutes ?? 0), 0),
      items,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

