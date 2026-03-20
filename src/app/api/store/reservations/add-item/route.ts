import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),

  serviceId: z.string().min(1),
  optionId: z.string().nullable().optional(), // requerido si NO es EXTRA
  quantity: z.number().int().min(1).max(50).default(1),
  pax: z.number().int().min(1).max(30).default(1),

  // para tu lÃ³gica de comisiones y reporting:
  isExtra: z.boolean().default(true), // por defecto, todo lo aÃ±adido es â€œextra/upsellâ€
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

    const { reservationId, serviceId, optionId, quantity, pax, isExtra } = parsed.data;

    const [svc, reservation] = await Promise.all([
      prisma.service.findUnique({
        where: { id: serviceId },
        select: { id: true, name: true, category: true, isActive: true },
      }),
      prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true },
      }),
    ]);

    if (!reservation) return new NextResponse("Reserva no existe", { status: 404 });
    if (!svc || !svc.isActive) return new NextResponse("Servicio no existe o estÃ¡ inactivo", { status: 404 });

    const now = new Date();

    // Determinar durationMin para buscar el ServicePrice vigente
    let durationMin: number | null = null;

    if (svc.category === "EXTRA") {
      // extras no usan optionId y precio va con durationMin=null
      durationMin = null;
      if (optionId) return new NextResponse("Los extras no llevan opciÃ³n", { status: 400 });
    } else {
      // servicios principales: necesitamos optionId para saber duraciÃ³n
      if (!optionId) return new NextResponse("Falta optionId para este servicio", { status: 400 });

      const opt = await prisma.serviceOption.findFirst({
        where: { id: optionId, serviceId, isActive: true },
        select: { durationMinutes: true, paxMax: true },
      });
      if (!opt) return new NextResponse("OpciÃ³n invÃ¡lida", { status: 400 });
      if (pax > opt.paxMax) return new NextResponse(`PAX mÃ¡ximo para esta opciÃ³n: ${opt.paxMax}`, { status: 400 });

      durationMin = opt.durationMinutes;
    }

    // Precio vigente
    const price = await prisma.servicePrice.findFirst({
      where: {
        serviceId,
        durationMin,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: { id: true, basePriceCents: true },
    });

    if (!price) {
      const label = svc.category === "EXTRA" ? "extra" : "servicio/duraciÃ³n";
      return new NextResponse(`Este ${label} no tiene precio vigente (Admin > Precios).`, { status: 400 });
    }

    const unitPriceCents = Number(price.basePriceCents);
    const totalPriceCents = unitPriceCents * quantity;

    await prisma.$transaction(async (tx) => {
      await tx.reservationItem.create({
        data: {
          reservationId,
          serviceId,
          optionId: svc.category === "EXTRA" ? null : optionId,
          servicePriceId: price.id,
          quantity,
          pax,
          unitPriceCents,
          totalPriceCents,
          isExtra,
        },
      });

      // Recalcular total de reserva desde items (fuente de verdad)
      const items = await tx.reservationItem.findMany({
        where: { reservationId },
        select: { totalPriceCents: true },
      });
      const newTotal = items.reduce((acc, it) => acc + Number(it.totalPriceCents || 0), 0);

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          totalPriceCents: newTotal,
          basePriceCents: newTotal, // mantenemos coherencia (legacy)
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}

