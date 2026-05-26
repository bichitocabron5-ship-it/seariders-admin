import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action")?.trim() ?? "";
  const entityType = url.searchParams.get("entityType")?.trim() ?? "";
  const entityId = url.searchParams.get("entityId")?.trim() ?? "";
  const source = url.searchParams.get("source")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const take = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;

  const where: Prisma.OperationalLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(source ? { source } : {}),
    ...(q
      ? {
          OR: [
            { actorName: { contains: q, mode: "insensitive" } },
            { action: { contains: q, mode: "insensitive" } },
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const logs = await prisma.operationalLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      userId: true,
      actorName: true,
      action: true,
      entityType: true,
      entityId: true,
      source: true,
      metadata: true,
      ip: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, logs });
}
