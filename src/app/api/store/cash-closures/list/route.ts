// src/app/api/store/cash-closures/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentOrigin, RoleName } from "@prisma/client";
import { originFromRoleName, parseBusinessDate } from "@/lib/cashClosures";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  date: z.string().min(10).max(10), // YYYY-MM-DD
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin"),
    date: u.searchParams.get("date"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Faltan params: origin, date" }, { status: 400 });

  const origin = parsed.data.origin;
  const businessDate = parseBusinessDate(parsed.data.date);

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== origin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.cashClosure.findMany({
    where: { origin, businessDate },
    orderBy: { closedAt: "desc" },
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      closedAt: true,
      isVoided: true,
      voidedAt: true,
      voidReason: true,
      reviewedAt: true,
      reviewNote: true,
      reviewedByUser: { select: { id: true, fullName: true, username: true } },
      declaredJson: true,
      systemJson: true,
      diffJson: true,
      closedByUser: { select: { id: true, fullName: true, username: true } },
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

