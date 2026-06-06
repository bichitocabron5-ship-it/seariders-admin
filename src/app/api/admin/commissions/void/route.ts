import { NextResponse } from "next/server";
import { ChannelCommissionLineStatus } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.string().trim().min(3).max(500),
});

function appendNote(existing: string | null | undefined, note: string) {
  const clean = note.trim();
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

  const uniqueIds = Array.from(new Set(parsed.data.ids));

  const result = await prisma.$transaction(async (tx) => {
    const paidCount = await tx.channelCommissionLine.count({
      where: { id: { in: uniqueIds }, status: ChannelCommissionLineStatus.PAID },
    });
    if (paidCount > 0) {
      throw Object.assign(new Error("No se pueden anular comisiones ya pagadas."), { status: 409 });
    }

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
          status: ChannelCommissionLineStatus.VOIDED,
          notes: appendNote(line.notes, parsed.data.reason),
        },
      });
    }

    return { updated: lines.length, requested: uniqueIds.length };
  }).catch((error: unknown) => {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "No se pudo anular";
    return { error: message, status };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ...result });
}
