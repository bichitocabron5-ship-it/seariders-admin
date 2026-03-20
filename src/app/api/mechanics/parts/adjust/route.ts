// src/app/api/mechanics/parts/adjust/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { SparePartMovementType } from "@prisma/client";

export const runtime = "nodejs";

async function requireMechanicHrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (["ADMIN", "MECHANIC", "HR"].includes(session.role as string)) return session;
  return null;
}

const Body = z.object({
  sparePartId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  qty: z.coerce.number().positive(),
  note: z.string().trim().min(1).max(2000),
  unitCostCents: z.coerce.number().int().min(0).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireMechanicHrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sparePart = await tx.sparePart.findUnique({
        where: { id: b.sparePartId },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          minStockQty: true,
          costPerUnitCents: true,
          isActive: true,
        },
      });

      if (!sparePart) {
        throw new Error("El recambio no existe.");
      }

      if (!sparePart.isActive) {
        throw new Error("El recambio está inactivo.");
      }

      if (b.direction === "OUT" && sparePart.stockQty < b.qty) {
        throw new Error(
          `Stock insuficiente. Disponible: ${sparePart.stockQty}, solicitado: ${b.qty}.`
        );
      }

      const movementType =
        b.direction === "IN"
          ? SparePartMovementType.ADJUSTMENT_IN
          : SparePartMovementType.ADJUSTMENT_OUT;

      const unitCostCents =
        b.unitCostCents != null
          ? b.unitCostCents
          : Number(sparePart.costPerUnitCents ?? 0);

      const totalCostCents = Math.round(unitCostCents * b.qty);

      const updatedPart = await tx.sparePart.update({
        where: { id: b.sparePartId },
        data: {
          stockQty:
            b.direction === "IN"
              ? { increment: b.qty }
              : { decrement: b.qty },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          minStockQty: true,
          costPerUnitCents: true,
          supplierName: true,
          isActive: true,
          updatedAt: true,
        },
      });

      const movement = await tx.sparePartMovement.create({
        data: {
          sparePartId: b.sparePartId,
          type: movementType,
          qty: b.qty,
          unitCostCents,
          totalCostCents,
          note: b.note.trim(),
          createdByUserId: session.userId,
        },
        select: {
          id: true,
          type: true,
          qty: true,
          unitCostCents: true,
          totalCostCents: true,
          note: true,
          createdAt: true,
          createdByUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      const lowStock =
        updatedPart.minStockQty != null &&
        updatedPart.minStockQty > 0 &&
        updatedPart.stockQty <= updatedPart.minStockQty;

      return {
        part: updatedPart,
        movement,
        stockAlert: lowStock
          ? `Stock bajo en ${updatedPart.name}: ${updatedPart.stockQty}`
          : null,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
