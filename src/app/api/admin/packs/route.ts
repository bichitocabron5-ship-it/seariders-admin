// src/app/api/admin/packs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationSource } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

/**
 * OJO:
 * - En Prisma el campo es allowedSources (ReservationSource[])
 */
const CreatePackBody = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(60),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  minPax: z.number().int().min(1).max(100),
  maxPax: z.number().int().min(1).max(200).nullable().optional(),
  pricePerPersonCents: z.number().int().min(0).max(10_000_000),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().nullable().optional(),
  allowedSources: z.array(z.enum(["STORE", "WEB"])).default(["STORE"]),
  items: z.array(z.object({
    serviceId: z.string().min(1),
    optionId: z.string().min(1), // obligatorio para simplificar logica
    quantity: z.number().int().min(1).max(999).default(1),
  })).default([]),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const packs = await prisma.pack.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: { id: "asc" },
        select: { id: true, serviceId: true, optionId: true, quantity: true },
      },
    },
  });

  return NextResponse.json(
    { packs },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreatePackBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invalidos", { status: 400 });

  const d = parsed.data;

  const packCode = d.code.trim().toUpperCase();           // SUPER_PACK
  const serviceCode = `PACK_${packCode}`;                // PACK_SUPER_PACK
  const optionCode = `${serviceCode}_OPT`;               // PACK_SUPER_PACK_OPT (unico global)
  
  const created = await prisma.$transaction(async (tx) => {
  // 1) Service (PACK)
  const svc = await tx.service.upsert({
    where: { code: serviceCode },
    update: {
      name: d.name.trim(),
      category: "PACK",
      isActive: d.isActive ?? true,
    },
    create: {
      code: serviceCode,
      name: d.name.trim(),
      category: "PACK",
      isActive: d.isActive ?? true,
    },
    select: { id: true, code: true },
  });

  // 2) Option (una "opcion pack")
  let opt = await tx.serviceOption.findFirst({
    where: { serviceId: svc.id, code: optionCode },
    select: { id: true },
  });

  if (!opt) {
    opt = await tx.serviceOption.create({
      data: {
        serviceId: svc.id,
        code: optionCode,
        durationMinutes: 0,
        paxMax: Number(d.maxPax ?? d.minPax ?? 1),
        contractedMinutes: 0,
        basePriceCents: 0,       // legacy, da igual si usas ServicePrice
        isActive: true,
      },
      select: { id: true },
    });
  }
  // 3) Price vigente (STORE lo usa para basePriceCents)
  // Si tu logica de packs es precio por persona, guarda pricePerPersonCents aqui
  await tx.servicePrice.create({
    data: {
      serviceId: svc.id,
      optionId: opt.id,
      basePriceCents: d.pricePerPersonCents,
      validFrom: d.validFrom ? new Date(d.validFrom) : new Date(),
      validTo: d.validTo ? new Date(d.validTo) : null,
      isActive: true,
    },
  });

  // 4) Pack (composicion)
  const pack = await tx.pack.create({
    data: {
      code: d.code.trim(),
      name: d.name.trim(),
      description: d.description ?? null,
      isActive: d.isActive ?? true,
      pricePerPersonCents: d.pricePerPersonCents,
      minPax: d.minPax,
      maxPax: d.maxPax ?? null,
      validFrom: d.validFrom ? new Date(d.validFrom) : new Date(),
      validTo: d.validTo ? new Date(d.validTo) : null,
      allowedSources: d.allowedSources as ReservationSource[],

      // links
      serviceId: svc.id,
      packOptionId: opt.id,
    },
    select: { id: true },
  });

  // 5) Items (actividades hijas)
  if (d.items.length > 0) {
    await tx.packItem.createMany({
      data: d.items.map((it) => ({
        packId: pack.id,
        serviceId: it.serviceId,
        optionId: it.optionId ?? null,
        quantity: it.quantity ?? 1,
      })),
    });
  }

  return pack;
});
  return NextResponse.json({ id: created.id });
}


