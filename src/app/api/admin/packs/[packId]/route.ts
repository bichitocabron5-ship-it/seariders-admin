// src/app/api/admin/packs/[packId]/route.ts
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

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(60).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  minPax: z.number().int().min(1).max(100).nullable().optional(),
  maxPax: z.number().int().min(1).max(200).nullable().optional(),
  pricePerPersonCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().nullable().optional(),
  allowedSources: z.array(z.enum(["STORE", "WEB"])).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ packId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { packId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invalidos", { status: 400 });

  const d = parsed.data;

  // Politica pro: code NO se edita
  if (d.code != null) {
    return new NextResponse("No se permite editar el codigo del pack. Crea uno nuevo o duplica.", { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) Leer pack con links
    const pack = await tx.pack.findUnique({
      where: { id: packId },
      select: { id: true, serviceId: true, packOptionId: true },
    });
    if (!pack) throw new Error("Pack no encontrado");

    // 2) Actualizar Pack (composicion/metadata)
    const updatedPack = await tx.pack.update({
      where: { id: packId },
      data: {
        name: d.name,
        description: d.description,
        isActive: d.isActive,
        minPax: d.minPax ?? undefined,
        maxPax: d.maxPax ?? undefined,
        pricePerPersonCents: d.pricePerPersonCents ?? undefined,
        validFrom: d.validFrom ? new Date(d.validFrom) : undefined,
        validTo: d.validTo === undefined ? undefined : d.validTo ? new Date(d.validTo) : null,
        allowedSources: d.allowedSources as ReservationSource[],
      },
      select: { id: true, name: true, isActive: true },
    });

    // 3) Mantener Service sincronizado (nombre + activo)
    if (pack.serviceId) {
      await tx.service.update({
        where: { id: pack.serviceId },
        data: {
          name: d.name ?? undefined,
          isActive: d.isActive ?? undefined,
          category: "PACK",
        },
      });
    }

    // 4) Mantener paxMax de la option pack (util para UI)
    if (pack.packOptionId) {
      // Si te interesa que paxMax refleje el maxPax (o minPax)
      const nextPaxMax =
        d.maxPax != null ? Number(d.maxPax) :
        d.minPax != null ? Number(d.minPax) :
        undefined;

      if (nextPaxMax != null) {
        await tx.serviceOption.update({
          where: { id: pack.packOptionId },
          data: { paxMax: nextPaxMax },
        });
      }
    }

    // 5) Precio: si se cambia pricePerPersonCents o fechas => cerrar precio vigente y crear uno nuevo
    const touchingPrice =
      d.pricePerPersonCents !== undefined ||
      d.validFrom !== undefined ||
      d.validTo !== undefined ||
      d.isActive !== undefined;

    if (touchingPrice && pack.serviceId && pack.packOptionId) {
      // cerramos precios vigentes del pack (service+option) para no dejar varios "activos"
      await tx.servicePrice.updateMany({
        where: {
          serviceId: pack.serviceId,
          optionId: pack.packOptionId,
          isActive: true,
        },
        data: { isActive: false },
      });

      const base = d.pricePerPersonCents ?? undefined;
      // si no mandan precio en PATCH, mantenemos el ultimo vigente (si existe) o 0
      let priceCents = base;
      if (priceCents === undefined) {
        const last = await tx.servicePrice.findFirst({
          where: { serviceId: pack.serviceId, optionId: pack.packOptionId },
          orderBy: { validFrom: "desc" },
          select: { basePriceCents: true },
        });
        priceCents = last?.basePriceCents ?? 0;
      }

      await tx.servicePrice.create({
        data: {
          serviceId: pack.serviceId,
          optionId: pack.packOptionId,
          basePriceCents: priceCents,
          validFrom: d.validFrom ? new Date(d.validFrom) : new Date(),
          validTo: d.validTo === undefined ? null : d.validTo ? new Date(d.validTo) : null,
          isActive: d.isActive ?? true,
        },
      });
    }

    return updatedPack;
  });

  return NextResponse.json(
    { ok: true, id: result.id },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function DELETE(_: Request, ctx: { params: Promise<{ packId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { packId } = await ctx.params;
  await prisma.pack.delete({ where: { id: packId } });

  return NextResponse.json({ ok: true });
}

