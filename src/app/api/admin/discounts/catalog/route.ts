// src/app/api/admin/discounts/catalog/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    where: { isActive: true, category: { not: "EXTRA" } },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  const options = await prisma.serviceOption.findMany({
    // where: { isActive: true },
    select: {
      id: true,
      serviceId: true,
      durationMinutes: true,
      paxMax: true,
      contractedMinutes: true,
    },
    orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }, { paxMax: "asc" }],
  });

  return NextResponse.json({ services, options });
}

