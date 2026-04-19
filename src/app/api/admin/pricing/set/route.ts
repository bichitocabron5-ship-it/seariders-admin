import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PricingTier } from "@prisma/client";

export const runtime = "nodejs";

const Body = z.object({
  serviceId: z.string().min(1),

  // UNO de los dos:
  optionId: z.string().min(1).nullable().optional(),          // precios por opción
  durationMin: z.number().int().min(1).max(600).nullable().optional(), // extras/legacy (null para extra fijo)
  pricingTier: z.nativeEnum(PricingTier).default(PricingTier.STANDARD),

  basePriceCents: z.number().int().min(0).max(50_000_000),
  validFrom: z.string().optional(), // ISO opcional (por defecto: ahora)
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const { serviceId, optionId, durationMin, pricingTier, basePriceCents } = parsed.data;
  const now = parsed.data.validFrom ? new Date(parsed.data.validFrom) : new Date();

  // Validación: no ambos
  if (optionId && durationMin != null) {
    return new NextResponse("Usa optionId o durationMin, no ambos", { status: 400 });
  }

  // Validación: si el servicio es EXTRA, debe ir sin optionId y durationMin = null
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, category: true, isActive: true },
  });
  if (!svc || !svc.isActive) return new NextResponse("Servicio no existe o está inactivo", { status: 404 });

  if (svc.category === "EXTRA") {
    if (optionId) return new NextResponse("Los extras no usan optionId", { status: 400 });
    if (durationMin !== null && durationMin !== undefined) {
      return new NextResponse("Los extras deben usar durationMin = null", { status: 400 });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    // Cerrar vigente anterior (si existe) para la misma clave
    await tx.servicePrice.updateMany({
      where: {
        serviceId,
        optionId: optionId ?? null,
        durationMin: optionId ? null : (durationMin ?? null),
        pricingTier,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      data: {
        validTo: now,
      },
    });

    // Crear nuevo vigente
    const p = await tx.servicePrice.create({
      data: {
        serviceId,
        optionId: optionId ?? null,
        durationMin: optionId ? null : (durationMin ?? null),
        pricingTier,
        basePriceCents,
        validFrom: now,
        validTo: null,
        isActive: true,
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
        isActive: true,
      },
    });

    return p;
  });

  return NextResponse.json({ price: created });
}

