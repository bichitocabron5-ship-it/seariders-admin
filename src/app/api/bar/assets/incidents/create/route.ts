// src/app/api/bar/assets/incidents/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { RentalAssetIncidentType, RentalAssetStatus } from "@prisma/client";

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
  type: z.nativeEnum(RentalAssetIncidentType),
  note: z.string().max(2000).optional().nullable(),
});

function statusFromIncident(type: RentalAssetIncidentType): RentalAssetStatus {
  switch (type) {
    case "DAMAGED":
      return "DAMAGED";
    case "MAINTENANCE":
      return "MAINTENANCE";
    case "LOST":
      return "LOST";
    default:
      return "MAINTENANCE";
  }
}

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

      const nextStatus = statusFromIncident(parsed.data.type);

      const incident = await tx.rentalAssetIncident.create({
        data: {
          rentalAssetId: asset.id,
          type: parsed.data.type,
          note: parsed.data.note?.trim() || null,
          openedByUserId: session.userId,
        },
        select: {
          id: true,
          type: true,
          note: true,
          openedAt: true,
        },
      });

      const updatedAsset = await tx.rentalAsset.update({
        where: { id: asset.id },
        data: {
          status: nextStatus,
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      });

      return {
        incident,
        asset: updatedAsset,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}