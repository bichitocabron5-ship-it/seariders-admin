// src/app/api/admin/jetskis/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { JetskiStatus } from "@prisma/client";

export const runtime = "nodejs";

const PatchBody = z.object({
  number: z.number().int().min(1).optional(),
  plate: z.string().trim().max(30).optional().nullable(),
  chassisNumber: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  owner: z.string().trim().max(80).optional().nullable(),
  maxPax: z.number().int().min(1).max(50).optional().nullable(),

  status: z.nativeEnum(JetskiStatus).optional(),

  currentHours: z.number().min(0).optional().nullable(),
  lastServiceHours: z.number().min(0).optional().nullable(),
  serviceIntervalHours: z.number().min(1).optional(),
  serviceWarnHours: z.number().min(1).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const jetski = await prisma.jetski.update({
      where: { id },
      data: {
        ...(b.number !== undefined ? { number: b.number } : {}),
        ...(b.plate !== undefined ? { plate: b.plate?.trim() || null } : {}),
        ...(b.chassisNumber !== undefined ? { chassisNumber: b.chassisNumber?.trim() || null } : {}),
        ...(b.model !== undefined ? { model: b.model?.trim() || null } : {}),
        ...(b.year !== undefined ? { year: b.year ?? null } : {}),
        ...(b.owner !== undefined ? { owner: b.owner?.trim() || null } : {}),
        ...(b.maxPax !== undefined ? { maxPax: b.maxPax ?? null } : {}),
        ...(b.status ? { status: b.status } : {}),

        ...(b.currentHours !== undefined ? { currentHours: b.currentHours ?? null } : {}),
        ...(b.lastServiceHours !== undefined ? { lastServiceHours: b.lastServiceHours ?? null } : {}),
        ...(b.serviceIntervalHours !== undefined ? { serviceIntervalHours: b.serviceIntervalHours } : {}),
        ...(b.serviceWarnHours !== undefined ? { serviceWarnHours: b.serviceWarnHours } : {}),
      },
      select: {
        id: true,
        number: true,
        model: true,
        year: true,
        plate: true,
        chassisNumber: true,
        maxPax: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, jetski });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("number")) {
      return new NextResponse("Ya existe una jetski con ese número", { status: 409 });
    }
    return new NextResponse("Error", { status: 400 });
  }
}
