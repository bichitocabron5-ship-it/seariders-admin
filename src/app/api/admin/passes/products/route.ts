// src/app/api/admin/passes/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || session.role !== "ADMIN") return null;
  return session;
}

const CreateBody = z.object({
  code: z.string().min(3).max(80),              // PASS_JETSKI_10H
  name: z.string().min(3).max(120),            // "Bono Jetski 10h"
  isActive: z.boolean().optional().default(true),

  serviceId: z.string().min(1),
  optionId: z.string().optional().nullable(),  // opcional

  totalMinutes: z.number().int().min(1).max(200000),
  priceCents: z.number().int().min(0).max(100000000),
  validDays: z.number().int().min(1).max(3650).optional().nullable(),
});

function normCode(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.passProduct.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      totalMinutes: true,
      priceCents: true,
      validDays: true,
      service: { select: { id: true, name: true, category: true } },
      option: { select: { id: true, durationMinutes: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ products: rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Body invalido", { status: 400 });

  const b = parsed.data;

  // Validacion coherente: si optionId viene, debe ser del servicio
  if (b.optionId) {
    const opt = await prisma.serviceOption.findUnique({
      where: { id: b.optionId },
      select: { id: true, serviceId: true },
    });
    if (!opt) return new NextResponse("optionId no existe", { status: 400 });
    if (opt.serviceId !== b.serviceId) return new NextResponse("La opcion no pertenece al servicio", { status: 400 });
  }

  try {
    const product = await prisma.passProduct.create({
      data: {
        code: normCode(b.code),
        name: b.name.trim(),
        isActive: b.isActive ?? true,
        serviceId: b.serviceId,
        optionId: b.optionId ?? null,
        totalMinutes: b.totalMinutes,
        priceCents: b.priceCents,
        validDays: b.validDays ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: product.id });
  } catch (e: unknown) {
    // code unique normalmente
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
