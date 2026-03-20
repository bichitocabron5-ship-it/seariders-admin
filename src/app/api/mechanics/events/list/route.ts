// src/app/api/mechanics/events/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MaintenanceEntityType } from "@prisma/client";
import { requireMechanicsOrAdmin } from "@/lib/mechanics-auth";

export const runtime = "nodejs";

const Query = z.object({
  entityType: z.nativeEnum(MaintenanceEntityType),
  entityId: z.string().min(1),
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(req: Request) {
  const session = await requireMechanicsOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    entityType: (url.searchParams.get("entityType") ?? "").toUpperCase(),
    entityId: url.searchParams.get("entityId") ?? "",
    take: url.searchParams.get("take") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { entityType, entityId, take } = parsed.data;

  const where =
    entityType === MaintenanceEntityType.JETSKI
      ? { entityType, jetskiId: entityId }
      : { entityType, assetId: entityId };

  const events = await prisma.maintenanceEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      entityType: true,
      type: true,
      jetskiId: true,
      assetId: true,
      hoursAtService: true,
      note: true,
      createdAt: true,
      createdByUserId: true,
      createdByUser: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({ ok: true, events });
}

