// src/app/api/admin/gifts/products/[id]/route.ts
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
  if (!session?.userId || String(session.role) !== "ADMIN") return null;
  return session;
}

type Ctx = { params: Promise<{ id: string }> };

// Para el toggle rápido (lo que ya tienes)
const ToggleBody = z.object({ isActive: z.boolean() });

// Para "Editar"
const UpdateBody = z.object({
  name: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  validDays: z.number().int().min(1).nullable().optional(),
  // opcional: permitir cambiar service/option desde edit
  // (yo lo dejaría bloqueado al principio para evitar líos)
  // serviceId: z.string().min(1).optional(),
  // optionId: z.string().min(1).optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const row = await prisma.giftProduct.findUnique({
    where: { id },
    include: {
      service: { select: { id: true, name: true, category: true } },
      option: { select: { id: true, durationMinutes: true, paxMax: true } },
    },
  });

  if (!row) return NextResponse.json({ error: "No existe" }, { status: 404 });

  return NextResponse.json({ ok: true, row });
}

// Mantén tu POST para toggle (compatibilidad con tu UI actual)
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = ToggleBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  await prisma.giftProduct.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
  });

  return NextResponse.json({ ok: true });
}

// Edit real
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  await prisma.giftProduct.update({
    where: { id },
    data: {
      name: parsed.data.name ?? undefined,
      priceCents: parsed.data.priceCents ?? undefined,
      validDays: parsed.data.validDays ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

