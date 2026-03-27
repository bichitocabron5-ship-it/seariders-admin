import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  note: z.string().trim().min(3).max(500),
});

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
    const task = await prisma.fulfillmentTask.findUnique({
      where: { id },
      select: {
        id: true,
        area: true,
        status: true,
        notes: true,
      },
    });

    if (!task) throw new Error("Tarea no encontrada.");
    if (task.area !== "BAR") throw new Error("La tarea no pertenece a BAR.");
    if (!["PENDING", "DELIVERED"].includes(task.status)) {
      throw new Error("La tarea ya no admite incidencia.");
    }

    const updatedTask = await prisma.fulfillmentTask.update({
      where: { id: task.id },
      data: {
        status: "CANCELED",
        notes: `${task.notes ? `${task.notes}\n` : ""}[INCIDENT] ${new Date().toISOString()} · ${session.userId} · ${parsed.data.note}`,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}
