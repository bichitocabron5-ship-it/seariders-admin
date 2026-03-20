// src/app/api/admin/pack-items/[itemId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

const PatchBody = z.object({
  serviceId: z.string().min(1).optional(),
  optionId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(50).optional(),
  pax: z.number().int().min(1).max(50).optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invalidos", { status: 400 });

  const { itemId } = await params;

  // si cambian service/option, revalidar pertenencia
  if (parsed.data.serviceId || parsed.data.optionId !== undefined) {
    const current = await prisma.packItem.findUnique({
      where: { id: itemId },
      select: { id: true, serviceId: true, optionId: true },
    });
    if (!current) return new NextResponse("PackItem no existe", { status: 404 });

    const nextServiceId = parsed.data.serviceId ?? current.serviceId;
    const nextOptionId = parsed.data.optionId === undefined ? current.optionId : parsed.data.optionId;

    const svc = await prisma.service.findUnique({ where: { id: nextServiceId }, select: { id: true } });
    if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

    if (nextOptionId) {
      const opt = await prisma.serviceOption.findUnique({
        where: { id: nextOptionId },
        select: { id: true, serviceId: true },
      });
      if (!opt) return new NextResponse("Opcion no existe", { status: 400 });
      if (opt.serviceId !== nextServiceId) return new NextResponse("La opcion no pertenece al servicio", { status: 400 });
    }
  }

  const updated = await prisma.packItem.update({
    where: { id: itemId },
    data: parsed.data as Prisma.PackItemUpdateInput,
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { itemId } = await params;
  await prisma.packItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}

