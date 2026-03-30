import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getIronSession<AppSession>(cookies() as unknown as never, sessionOptions);
  if (!session?.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      options: {
        where: { isActive: true },
        select: { durationMinutes: true },
      },
      servicePrices: {
        where: { isActive: true },
        select: {
          id: true,
          durationMin: true,
          basePriceCents: true,
          validFrom: true,
          validTo: true,
        },
      },
    },
  });

  // Normalizamos "durations" por servicio:
  // - EXTRAs: [null]
  // - resto: duraciones únicas de ServiceOption
  const normalized = services.map((s) => {
    const durationSet = new Set<number>();
    for (const o of s.options) durationSet.add(o.durationMinutes);

    const durations =
      s.category === "EXTRA"
        ? [null]
        : Array.from(durationSet).sort((a, b) => a - b);

    // Mapa de precio activo por duración
    const priceByDuration: Record<string, unknown> = {};
    for (const p of s.servicePrices) {
      const key = p.durationMin === null ? "null" : String(p.durationMin);
      priceByDuration[key] = p;
    }

    return {
      id: s.id,
      name: s.name,
      category: s.category,
      isActive: s.isActive,
      durations, // number[] o [null]
      priceByDuration,
    };
  });

  return NextResponse.json({ services: normalized });
}

