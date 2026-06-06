import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  notes: z.string().max(800).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const data: { notes?: string | null; dueDate?: Date | null } = {};
  if ("notes" in parsed.data) {
    const notes = parsed.data.notes == null ? null : parsed.data.notes.trim();
    data.notes = notes || null;
  }
  if ("dueDate" in parsed.data) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  const row = await prisma.channelCommissionLine.update({
    where: { id },
    data,
    select: {
      id: true,
      dueDate: true,
      notes: true,
      updatedAt: true,
    },
  }).catch(() => null);

  if (!row) return NextResponse.json({ error: "Linea no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true, row });
}
