// src/app/api/admin/packs/[packId]/items/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

const Body = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1).nullable().optional(), // si tu pack item puede ir sin opcion
  quantity: z.number().int().min(1).max(50).default(1),
  pax: z.number().int().min(1).max(50).default(1),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
});

export async function POST( req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invalidos", { status: 400 });

  // validaciones basicas: service existe, option (si viene) pertenece al servicio
  const svc = await prisma.service.findUnique({ where: { id: parsed.data.serviceId }, select: { id: true } });
  if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

  if (parsed.data.optionId) {
    const opt = await prisma.serviceOption.findUnique({
      where: { id: parsed.data.optionId },
      select: { id: true, serviceId: true },
    });
    if (!opt) return new NextResponse("Opcion no existe", { status: 400 });
    if (opt.serviceId !== parsed.data.serviceId) return new NextResponse("La opcion no pertenece al servicio", { status: 400 });
  }

   const created = await prisma.packItem.create({
    data: {
      packId, // ahora ya no sera undefined
      serviceId: parsed.data.serviceId,
      optionId: parsed.data.optionId ?? null,
      quantity: parsed.data.quantity,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
