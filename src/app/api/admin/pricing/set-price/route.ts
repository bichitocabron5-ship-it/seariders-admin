import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1).nullable(), // âœ… NUEVO: null para extras
  basePriceCents: z.number().int().min(0).max(10_000_000),
  validFrom: z.string().optional(), // ISO opcional
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

  const { serviceId, optionId, basePriceCents } = parsed.data;
  const validFrom = parsed.data.validFrom ? new Date(parsed.data.validFrom) : new Date();

  // 1) Validar servicio
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, name: true, category: true },
  });
  if (!svc) return new NextResponse("Servicio no existe", { status: 404 });

  // 2) Reglas:
  // - EXTRAS: optionId debe ser null
  // - PRINCIPALES: optionId debe existir y pertenecer al servicio
  if (svc.category === "EXTRA") {
    if (optionId !== null) return new NextResponse("Extras deben usar optionId = null", { status: 400 });
  } else {
    if (!optionId) return new NextResponse("Falta optionId para este servicio", { status: 400 });

    const opt = await prisma.serviceOption.findFirst({
      where: { id: optionId, serviceId, isActive: true },
      select: { id: true },
    });
    if (!opt) return new NextResponse("OptionId invÃ¡lido para este servicio", { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    // 3) Cerrar precio vigente anterior para (serviceId + optionId)
    await tx.servicePrice.updateMany({
      where: {
        serviceId,
        optionId: optionId, // âœ… clave real
        isActive: true,
      },
      data: {
        isActive: false,
        validTo: validFrom,
      },
    });

    // 4) Crear nuevo precio vigente
    const p = await tx.servicePrice.create({
      data: {
        serviceId,
        optionId: optionId, // âœ… guardamos optionId
        durationMin: null,  // dejamos durationMin solo para compatibilidad (ya no lo usamos aquÃ­)
        basePriceCents,
        validFrom,
        validTo: null,
        isActive: true,
      },
      select: {
        id: true,
        serviceId: true,
        optionId: true,
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

