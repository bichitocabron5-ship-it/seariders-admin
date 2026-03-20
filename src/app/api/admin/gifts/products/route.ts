// src/app/api/admin/gifts/products/route.ts
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

const CreateBody = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  name: z.string().max(120).nullable().optional(),
  priceCents: z.number().int().min(0),
  validDays: z.number().int().min(1).max(3650).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.giftProduct.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      serviceId: true,
      optionId: true,
      priceCents: true,
      validDays: true,
      createdAt: true,
      updatedAt: true,

      service: { select: { id: true, name: true, category: true } },
      option: {
        select: {
          id: true,
          code: true,
          durationMinutes: true,
          paxMax: true,
          contractedMinutes: true,
          basePriceCents: true,
          isActive: true,
        },
      },
    },
  });

  const mapped = rows.map((r) => ({
    ...r,
    // si no hay name, construimos uno bonito
    name:
      r.name?.trim() ||
      `${r.service.category} · ${r.service.name} · ${r.option.durationMinutes} min · ${r.option.paxMax} pax`,
  }));

  return NextResponse.json({ ok: true, rows: mapped });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const { serviceId, optionId, priceCents, validDays, isActive } = parsed.data;

  // validacion basica
  const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, name: true, category: true } });
  const opt = await prisma.serviceOption.findUnique({ where: { id: optionId }, select: { id: true } });
  if (!svc || !opt) return NextResponse.json({ error: "Service/Option no existen" }, { status: 400 });

  const name =
    parsed.data.name?.trim() ||
    `${svc.category} · ${svc.name}`;

  const created = await prisma.giftProduct.create({
    data: {
      serviceId,
      optionId,
      name,
      priceCents,
      validDays: validDays ?? null,
      isActive: isActive ?? true,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}


