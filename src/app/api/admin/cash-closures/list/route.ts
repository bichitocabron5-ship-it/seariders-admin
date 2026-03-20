// src/app/api/admin/cash-closures/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PaymentOrigin, ShiftName } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin).optional(),
  shift: z.nativeEnum(ShiftName).optional(),
  date: z.string().min(10).max(10).optional(), // YYYY-MM-DD
  includeVoided: z.enum(["0", "1"]).optional(),
  take: z.string().optional(),
});

function parseBusinessDate(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00.000");
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin") ?? undefined,
    shift: u.searchParams.get("shift") ?? undefined,
    date: u.searchParams.get("date") ?? undefined,
    includeVoided: u.searchParams.get("includeVoided") ?? undefined,
    take: u.searchParams.get("take") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "ParÃ¡metros invÃ¡lidos" }, { status: 400 });

  const take = Math.min(200, Math.max(20, Number(parsed.data.take ?? 80)));

  const where: Prisma.CashClosureWhereInput = {};
  if (parsed.data.origin) where.origin = parsed.data.origin;
  if (parsed.data.shift) where.shift = parsed.data.shift;
  if (parsed.data.date) where.businessDate = parseBusinessDate(parsed.data.date);
  if (parsed.data.includeVoided !== "1") where.isVoided = false;

  const rows = await prisma.cashClosure.findMany({
    where,
    take,
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
      reviewedAt: true,
      reviewNote: true,
      reviewedByUser: { select: { id: true, fullName: true, username: true } },
      closedByUser: { select: { id: true, fullName: true, username: true } },
      voidedByUser: { select: { id: true, fullName: true, username: true } },
      // totales resumidos para la tabla
      declaredJson: true,
      systemJson: true,
      diffJson: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}

