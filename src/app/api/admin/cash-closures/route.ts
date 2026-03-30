// src/app/api/admin/cash-closures/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentOrigin } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin).optional(),
  date: z.string().min(10).max(10).optional(),
});

function parseBusinessDate(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00.000");
  if (!Number.isFinite(d.getTime())) throw new Error("date inválida");
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin") || undefined,
    date: u.searchParams.get("date") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Params inválidos" }, { status: 400 });

  const where: Prisma.CashClosureWhereInput = {};
  if (parsed.data.origin) where.origin = parsed.data.origin;
  if (parsed.data.date) where.businessDate = parseBusinessDate(parsed.data.date);

  const rows = await prisma.cashClosure.findMany({
    where,
    orderBy: [{ businessDate: "desc" }, { closedAt: "desc" }],
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      windowFrom: true,
      windowTo: true,
      closedAt: true,
      isVoided: true,
      voidedAt: true,
      voidReason: true,
      declaredJson: true,
      systemJson: true,
      diffJson: true,
      closedByUser: { select: { id: true, fullName: true, username: true } },
      voidedByUser: { select: { id: true, fullName: true, username: true } },
      users: {
        select: {
          user: { select: { id: true, fullName: true, username: true } },
          roleNameAtClose: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

