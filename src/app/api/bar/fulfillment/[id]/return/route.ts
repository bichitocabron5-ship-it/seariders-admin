import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

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

export async function POST(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.fulfillmentTask.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          area: true,
          status: true,
          returnedAt: true,
          assetAssignments: {
            select: {
              id: true,
              rentalAssetId: true,
              returnedAt: true,
            },
          },
          items: {
            select: {
              id: true,
              kind: true,
              deliveredAt: true,
              returnedAt: true,
            },
          },
        },
      });

      if (!task) throw new Error("Tarea no encontrada.");
      if (task.area !== "BAR") throw new Error("La tarea no pertenece a BAR.");
      if (task.type !== "EXTRA_DELIVERY") {
        throw new Error("Solo los extras reutilizables permiten devolución.");
      }
      if (task.status !== "DELIVERED") {
        throw new Error("Solo se puede marcar como devuelto un extra entregado.");
      }
      if (task.returnedAt) {
        throw new Error("La tarea ya está marcada como devuelta.");
      }

      for (const a of task.assetAssignments) {
        if (a.returnedAt) continue;

        await tx.fulfillmentAssetAssignment.update({
          where: { id: a.id },
          data: {
            returnedAt: new Date(),
            returnedByUserId: session.userId,
            returnOk: true,
          },
        });

        await tx.rentalAsset.update({
          where: { id: a.rentalAssetId },
          data: {
            status: "AVAILABLE",
          },
        });
      }

      await tx.fulfillmentTaskItem.updateMany({
        where: {
          taskId: task.id,
          deliveredAt: { not: null },
          returnedAt: null,
        },
        data: {
          returnedAt: new Date(),
        },
      });

      const updated = await tx.fulfillmentTask.update({
        where: { id: task.id },
        data: {
          status: "RETURNED",
          returnedAt: new Date(),
          returnedByUserId: session.userId,
        },
        select: {
          id: true,
          status: true,
          deliveredAt: true,
          returnedAt: true,
        },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, task: result });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}