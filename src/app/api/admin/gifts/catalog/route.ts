// src/app/api/admin/gifts/catalog/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      options: {
        where: { isActive: true },
        select: { id: true, code: true, durationMinutes: true, paxMax: true },
        orderBy: [{ durationMinutes: "asc" }, { paxMax: "asc" }],
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ ok: true, services });
}

