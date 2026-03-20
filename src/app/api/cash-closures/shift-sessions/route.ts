// src/app/api/cash-closures/shift-sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentOrigin, ShiftName, RoleName } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { originFromRoleName, parseBusinessDate } from "@/lib/cashClosures";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  shift: z.nativeEnum(ShiftName),
  date: z.string().min(10).max(10), // YYYY-MM-DD
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url);
  const parsed = Q.safeParse({
    origin: u.searchParams.get("origin"),
    shift: u.searchParams.get("shift"),
    date: u.searchParams.get("date"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Faltan params: origin, shift, date" }, { status: 400 });

  const { origin, shift, date } = parsed.data;
  const businessDate = parseBusinessDate(date);

  // permisos: role->origin o ADMIN
  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== origin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // día operativo: 00:00..23:59 del businessDate
  const d0 = new Date(businessDate);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(businessDate);
  d1.setHours(23, 59, 59, 999);

  const where: Prisma.ShiftSessionWhereInput = {
    shift,
    startedAt: { gte: d0, lte: d1 },
  };
  if (String(session.role) !== "ADMIN") {
    where.role = { name: session.role as RoleName };
  }

  // Si NO es admin: solo sesiones del mismo origin (por rol) y del día+shift.
  // Si es admin: puede ver todas del origin para ese día+shift.
  const rows = await prisma.shiftSession.findMany({
    where,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      user: { select: { id: true, fullName: true, username: true } },
      role: { select: { name: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  // Filtra por origin real (según rol de la sesión)
  const filtered = rows.filter((r) => originFromRoleName(r.role.name as RoleName) === origin);

  return NextResponse.json({
    ok: true,
    rows: filtered.map((r) => ({
      id: r.id,
      userId: r.user.id,
      label: r.user.fullName ?? r.user.username ?? r.user.id,
      role: r.role.name,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
    })),
  });
}
