// src/app/api/admin/catalog/[optionsId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  paxMax: z.coerce.number().int().min(1).max(30).optional(),
  contractedMinutes: z.coerce.number().int().min(1).max(600).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  // Evitar duplicados si cambian duration/pax:
  const { optionId } = await params;

  const current = await prisma.serviceOption.findUnique({
    where: { id: optionId },
    select: { id: true, serviceId: true, durationMinutes: true, paxMax: true },
  });
  if (!current) return new NextResponse("Opción no existe", { status: 404 });

  const nextDuration = parsed.data.durationMinutes ?? current.durationMinutes;
  const nextPax = parsed.data.paxMax ?? current.paxMax;

  if (nextDuration !== current.durationMinutes || nextPax !== current.paxMax) {
    const exists = await prisma.serviceOption.findFirst({
      where: {
        serviceId: current.serviceId,
        durationMinutes: nextDuration,
        paxMax: nextPax,
        NOT: { id: current.id },
      },
      select: { id: true },
    });
    if (exists) return new NextResponse("Ya existe otra opción con esa duración y PAX", { status: 400 });
  }

  const updated = await prisma.serviceOption.update({
    where: { id: optionId },
    data: parsed.data,
    select: {
      id: true,
      durationMinutes: true,
      paxMax: true,
      contractedMinutes: true,
      isActive: true,
    },
  });

  return NextResponse.json({ option: updated });
}

