import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  const [servicesMain, servicesExtra, options, prices] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true, category: { not: "EXTRA" } },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { isActive: true, category: "EXTRA" },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceOption.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serviceId: true,
        durationMinutes: true,
        paxMax: true,
        contractedMinutes: true,
        isActive: true,
      },
      orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }, { paxMax: "asc" }],
    }),
    prisma.servicePrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: {
        id: true,
        serviceId: true,
        optionId: true,
        durationMin: true,
        pricingTier: true,
        basePriceCents: true,
        validFrom: true,
        validTo: true,
      },
      orderBy: { validFrom: "desc" }, // importante: el más nuevo primero
    }),
  ]);

  // Precio vigente por optionId
  const byOption: Record<string, Prisma.ServicePriceGetPayload<{ select: { id: true; serviceId: true; optionId: true; durationMin: true; pricingTier: true; basePriceCents: true; validFrom: true; validTo: true } }>> = {};
  // Precio vigente por durationMin (extras/legacy)
  const byDuration: Record<string, Prisma.ServicePriceGetPayload<{ select: { id: true; serviceId: true; optionId: true; durationMin: true; pricingTier: true; basePriceCents: true; validFrom: true; validTo: true } }>> = {};

  for (const p of prices) {
    if (p.optionId) {
      const k = `${p.serviceId}:${p.optionId}:${p.pricingTier}`;
      if (!byOption[k]) byOption[k] = p;
    } else {
      const k = `${p.serviceId}:${p.durationMin ?? "null"}:${p.pricingTier}`;
      if (!byDuration[k]) byDuration[k] = p;
    }
  }

  return NextResponse.json({
    servicesMain,
    servicesExtra,
    options,
    prices: { byOption, byDuration },
    now,
  });
}

