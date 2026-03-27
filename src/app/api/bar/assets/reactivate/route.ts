// src/app/api/bar/assets/reactivate/route.ts
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
  rentalAssetId: z.string().min(1),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.rentalAsset.findUnique({
        where: { id: parsed.data.rentalAssetId },
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
          status: true,
        },
      });

      if (!asset || !asset.isActive) {
        throw new Error("Unidad no encontrada o inactiva.");
      }

      if (asset.status === "DELIVERED") {
        throw new Error("No se puede reactivar una unidad entregada.");
      }

      const updated = await tx.rentalAsset.update({
        where: { id: asset.id },
        data: {
          status: "AVAILABLE",
          ...(parsed.data.note?.trim()
            ? {
                notes: parsed.data.note.trim(),
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          notes: true,
        },
      });

      return updated;
    });

    return NextResponse.json({
      ok: true,
      asset: result,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}