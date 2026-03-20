// src/app/api/mechanics/parts/movements/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SparePartMovementType } from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Body = z.object({
  sparePartId: z.string().min(1),
  type: z.nativeEnum(SparePartMovementType),
  qty: z.coerce.number().positive(),
  unitCostCents: z.coerce.number().int().min(0).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.findUnique({
        where: { id: b.sparePartId },
        select: { id: true, stockQty: true },
      });
      if (!part) throw new Error("Recambio no existe");

      let nextStock = Number(part.stockQty);
      if (
        b.type === SparePartMovementType.INITIAL_STOCK ||
        b.type === SparePartMovementType.PURCHASE ||
        b.type === SparePartMovementType.RETURN ||
        b.type === SparePartMovementType.ADJUSTMENT_IN
      ) {
        nextStock += b.qty;
      }
      if (
        b.type === SparePartMovementType.CONSUMPTION ||
        b.type === SparePartMovementType.ADJUSTMENT_OUT
      ) {
        nextStock -= b.qty;
      }

      if (nextStock < 0) throw new Error("Stock insuficiente");

      const movement = await tx.sparePartMovement.create({
        data: {
          sparePartId: b.sparePartId,
          type: b.type,
          qty: b.qty,
          unitCostCents: b.unitCostCents ?? null,
          note: b.note?.trim() || null,
          createdByUserId: session.userId,
        },
      });

      await tx.sparePart.update({
        where: { id: b.sparePartId },
        data: { stockQty: nextStock },
      });

      return movement;
    });

    return NextResponse.json({ ok: true, row: out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}

