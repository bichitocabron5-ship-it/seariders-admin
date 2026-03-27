// src/app/api/bar/assets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { RentalAssetStatus, RentalAssetType } from "@prisma/client";

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

const Query = z.object({
  type: z.nativeEnum(RentalAssetType).optional(),
  status: z.nativeEnum(RentalAssetStatus).optional(),
});

export async function GET(req: Request) {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const u = new URL(req.url);
  const parsed = Query.safeParse({
    type: u.searchParams.get("type") ?? undefined,
    status: u.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Parámetros inválidos", { status: 400 });
  }

  const rows = await prisma.rentalAsset.findMany({
    where: {
      isActive: true,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: [{ type: "asc" }, { size: "asc" }, { code: "asc" }, { name: "asc" }],
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      size: true,
      status: true,
      notes: true,
      assignments: {
        where: {
          returnedAt: null,
        },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          task: {
            select: {
              id: true,
              reservation: { select: { id: true, customerName: true } },
            },
          },
          assignedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    rows,
  });
}