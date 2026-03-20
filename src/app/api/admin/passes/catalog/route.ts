// src/app/api/admin/passes/catalog/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });

  const options = await prisma.serviceOption.findMany({
    orderBy: [{ durationMinutes: "asc" }],
    select: {
      id: true,
      serviceId: true,
      durationMinutes: true,
      paxMax: true,
      contractedMinutes: true,
    },
  });

  return NextResponse.json({ services, options });
}
