// src/app/api/bar/fulfillment/[id]/deliver/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

async function requireBarOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "BAR") return session;
  return null;
}

const Body = z.object({
  assignments: z
    .array(
      z.object({
        taskItemId: z.string().min(1),
        rentalAssetId: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.fulfillmentTask.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          status: true,
          area: true,
          items: {
            select: {
              id: true,
              nameSnap: true,
              quantity: true,
              kind: true,
              barProductId: true,
              deliveredAt: true,
            },
          },
        },
      });

      if (!task) throw new Error("Tarea no encontrada.");
      if (task.area !== "BAR") throw new Error("La tarea no pertenece a BAR.");
      if (task.status !== "PENDING") throw new Error("La tarea ya no está pendiente.");

      const assignmentsMap = new Map(
        parsed.data.assignments.map((a) => [a.taskItemId, a.rentalAssetId])
      );

      // 1) Validar y descontar stock de productos de bar
      for (const item of task.items) {
        if (!item.barProductId) continue;

        const product = await tx.barProduct.findUnique({
          where: { id: item.barProductId },
          select: {
            id: true,
            name: true,
            controlsStock: true,
            currentStock: true,
          },
        });

        if (!product) {
          throw new Error(`Producto no encontrado para item ${item.nameSnap}.`);
        }

        if (!product.controlsStock) continue;

        const qty = Number(item.quantity ?? 0);
        const stockBefore = Number(product.currentStock ?? 0);

        if (qty <= 0) continue;

        if (stockBefore < qty) {
          throw new Error(
            `Stock insuficiente para ${product.name}. Disponible: ${stockBefore}, requerido: ${qty}.`
          );
        }

        const stockAfter = stockBefore - qty;

        await tx.barProduct.update({
          where: { id: product.id },
          data: {
            currentStock: stockAfter,
          },
        });

        await tx.barStockMovement.create({
          data: {
            productId: product.id,
            type: "OUT",
            reason: task.type === "CATERING" ? "CATERING_DELIVERY" : "EXTRA_DELIVERY",
            quantity: qty,
            stockBefore,
            stockAfter,
            notes: `Entrega fulfillment ${task.id} · ${item.nameSnap}`,
            sourceType: "FULFILLMENT_TASK",
            sourceId: task.id,
            userId: session.userId,
          },
        });
      }

      // 2) Para extras: exigir unidades y asignarlas
      if (task.type === "EXTRA_DELIVERY") {
        const extraItems = task.items.filter((it) => it.kind === "EXTRA");

        for (const item of extraItems) {
          const qty = Number(item.quantity ?? 0);

          if (qty !== 1) {
            throw new Error(
              `Por ahora cada item reutilizable debe venir como cantidad 1. Revisa ${item.nameSnap}.`
            );
          }

          const rentalAssetId = assignmentsMap.get(item.id);
          if (!rentalAssetId) {
            throw new Error(`Falta seleccionar unidad para ${item.nameSnap}.`);
          }

          const asset = await tx.rentalAsset.findUnique({
            where: { id: rentalAssetId },
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              isActive: true,
            },
          });

          if (!asset || !asset.isActive) {
            throw new Error(`Unidad no encontrada o inactiva para ${item.nameSnap}.`);
          }

          if (asset.status !== "AVAILABLE") {
            throw new Error(`La unidad ${asset.code ?? asset.name} ya no está disponible.`);
          }

          await tx.fulfillmentAssetAssignment.create({
            data: {
              taskId: task.id,
              taskItemId: item.id,
              rentalAssetId: asset.id,
              assignedAt: new Date(),
              assignedByUserId: session.userId,
            },
          });

          await tx.rentalAsset.update({
            where: { id: asset.id },
            data: {
              status: "DELIVERED",
            },
          });
        }
      }

      // 3) Marcar items entregados
      await tx.fulfillmentTaskItem.updateMany({
        where: {
          taskId: task.id,
          deliveredAt: null,
        },
        data: {
          deliveredAt: new Date(),
        },
      });

      // 4) Marcar tarea entregada
      const updatedTask = await tx.fulfillmentTask.update({
        where: { id: task.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveredByUserId: session.userId,
        },
        select: {
          id: true,
          status: true,
          deliveredAt: true,
        },
      });

      return updatedTask;
    });

    return NextResponse.json({ ok: true, task: result });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}