import { NextResponse } from "next/server";
import {
  ChannelCommissionLineStatus,
  PaymentMethod,
} from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  paidAt: z.string().datetime().optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  notes: z.string().max(800).optional().nullable(),
});

function appendNote(existing: string | null | undefined, note?: string | null) {
  const clean = String(note ?? "").trim();
  if (!clean) return existing ?? null;
  const current = String(existing ?? "").trim();
  if (!current) return clean.slice(0, 800);
  return `${current} | ${clean}`.slice(0, 800);
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  const uniqueIds = Array.from(new Set(parsed.data.ids));

  const result = await prisma.$transaction(async (tx) => {
    const lines = await tx.channelCommissionLine.findMany({
      where: {
        id: { in: uniqueIds },
        status: ChannelCommissionLineStatus.PENDING,
      },
      select: { id: true, notes: true },
    });

    for (const line of lines) {
      await tx.channelCommissionLine.update({
        where: { id: line.id },
        data: {
          status: ChannelCommissionLineStatus.PAID,
          paidAt,
          paidByUserId: session.userId,
          paymentMethod: parsed.data.paymentMethod ?? null,
          notes: appendNote(line.notes, parsed.data.notes),
        },
      });
    }

    return { updated: lines.length, requested: uniqueIds.length };
  });

  return NextResponse.json({ ok: true, ...result });
}
