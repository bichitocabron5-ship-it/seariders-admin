// src/app/api/admin/passes/products/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || session.role !== "ADMIN") return null;
  return session;
}

const PatchBody = z.object({
  code: z.string().min(3).max(80).optional(),
  name: z.string().min(3).max(120).optional(),
  isActive: z.boolean().optional(),

  serviceId: z.string().min(1).optional(),
  optionId: z.string().optional().nullable(),

  totalMinutes: z.number().int().min(1).max(200000).optional(),
  priceCents: z.number().int().min(0).max(100000000).optional(),
  validDays: z.number().int().min(1).max(3650).optional().nullable(),
});

function normCode(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Body invalido", { status: 400 });

  const b = parsed.data;

  const existing = await prisma.passProduct.findUnique({
    where: { id },
    select: { id: true, serviceId: true },
  });
  if (!existing) return new NextResponse("Producto no existe", { status: 404 });

  const nextServiceId = b.serviceId ?? existing.serviceId;

  if (b.optionId) {
    const opt = await prisma.serviceOption.findUnique({
      where: { id: b.optionId },
      select: { id: true, serviceId: true },
    });
    if (!opt) return new NextResponse("optionId no existe", { status: 400 });
    if (opt.serviceId !== nextServiceId) return new NextResponse("La opcion no pertenece al servicio", { status: 400 });
  }

  const data: Prisma.PassProductUpdateInput = {};
  if (b.code !== undefined) data.code = normCode(b.code);
  if (b.name !== undefined) data.name = b.name.trim();
  if (b.isActive !== undefined) data.isActive = b.isActive;

  if (b.serviceId !== undefined) data.service = { connect: { id: b.serviceId } };
  if (b.optionId !== undefined) data.option = b.optionId ? { connect: { id: b.optionId } } : { disconnect: true };

  if (b.totalMinutes !== undefined) data.totalMinutes = b.totalMinutes;
  if (b.priceCents !== undefined) data.priceCents = b.priceCents;
  if (b.validDays !== undefined) data.validDays = b.validDays ?? null;

  try {
    await prisma.passProduct.update({
      where: { id },
      data,
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}

