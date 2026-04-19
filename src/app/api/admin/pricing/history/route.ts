// src/app/api/admin/pricing/history/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || null;

  let optionId: string | null | undefined = undefined;
  if (url.searchParams.has("optionId")) {
    const raw = url.searchParams.get("optionId");
    optionId = raw === "null" ? null : (raw || "");
  }

  const where: Prisma.ServicePriceWhereInput = {};
  if (serviceId) where.serviceId = serviceId;
  if (optionId !== undefined) {
    // Si viene optionId vacio "", lo ignoramos (equivale a "todas").
    if (optionId !== "") where.optionId = optionId;
  }

  const rowsDb = await prisma.servicePrice.findMany({
    where,
    orderBy: { validFrom: "desc" },
    select: {
      id: true,
      serviceId: true,
      optionId: true,
      durationMin: true,
      pricingTier: true,
      basePriceCents: true,
      validFrom: true,
      validTo: true,
      isActive: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true, paxMax: true, contractedMinutes: true } },
    },
    take: 300,
  });

  const rows = rowsDb.map((r) => ({
    id: r.id,
    serviceId: r.serviceId,
    serviceName: r.service?.name ?? null,
    serviceCategory: r.service?.category ?? null,
    optionId: r.optionId,
    optionLabel: r.option
      ? `${r.option.durationMinutes} min · hasta ${r.option.paxMax} pax · contratado ${r.option.contractedMinutes} min`
      : null,
    durationMin: r.durationMin,
    pricingTier: r.pricingTier,
    basePriceCents: r.basePriceCents,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo ? r.validTo.toISOString() : null,
    isActive: r.isActive,
  }));

  return NextResponse.json({ rows });
}

