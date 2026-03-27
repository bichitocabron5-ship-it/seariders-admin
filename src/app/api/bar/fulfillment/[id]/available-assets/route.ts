// src/app/api/bar/fulfillment/[id]/available-assets/route.ts
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

function inferAssetFilterFromName(name: string) {
  const upper = String(name || "").toUpperCase();

  if (upper.includes("GOPRO")) {
    return { type: "GOPRO" as const };
  }

  if (upper.includes("NEOPRENO")) {
    const sizeMatch =
      upper.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/) ||
      upper.match(/\b(T-?XXS|T-?XS|T-?S|T-?M|T-?L|T-?XL|T-?XXL)\b/);

    const rawSize = sizeMatch?.[1]?.replace("T-", "") ?? null;

    return {
      type: "WETSUIT" as const,
      size: rawSize,
    };
  }

  return { type: "OTHER" as const };
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const task = await prisma.fulfillmentTask.findUnique({
    where: { id },
    select: {
      id: true,
      area: true,
      type: true,
      status: true,
      items: {
        select: {
          id: true,
          kind: true,
          nameSnap: true,
          quantity: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) {
    return new NextResponse("Tarea no encontrada", { status: 404 });
  }

  if (task.area !== "BAR") {
    return new NextResponse("La tarea no pertenece a BAR", { status: 400 });
  }

  if (task.type !== "EXTRA_DELIVERY") {
    return NextResponse.json({ ok: true, rows: [] });
  }

  const rows = [];

  for (const item of task.items) {
    if (item.kind !== "EXTRA") continue;

    const filter = inferAssetFilterFromName(item.nameSnap);

    const available = await prisma.rentalAsset.findMany({
      where: {
        isActive: true,
        status: "AVAILABLE",
        type: filter.type,
        ...(filter.type === "WETSUIT" && filter.size ? { size: filter.size } : {}),
      },
      orderBy: [{ size: "asc" }, { code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        size: true,
        status: true,
      },
    });

    rows.push({
      taskItemId: item.id,
      itemName: item.nameSnap,
      quantity: Number(item.quantity ?? 0),
      assets: available,
    });
  }

  return NextResponse.json({
    ok: true,
    rows,
  });
}