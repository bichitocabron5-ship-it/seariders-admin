// src/app/api/admin/bar/assets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { RentalAssetType, RentalAssetStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role !== "ADMIN") return null;
  return session;
}

const Query = z.object({
  type: z.nativeEnum(RentalAssetType).optional(),
  status: z.nativeEnum(RentalAssetStatus).optional(),
  active: z.enum(["true", "false"]).optional(),
});

const CreateBody = z.object({
  type: z.nativeEnum(RentalAssetType),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).optional().nullable(),
  size: z.string().trim().max(20).optional().nullable(),
  status: z.nativeEnum(RentalAssetStatus).optional(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const u = new URL(req.url);
  const parsed = Query.safeParse({
    type: u.searchParams.get("type") ?? undefined,
    status: u.searchParams.get("status") ?? undefined,
    active: u.searchParams.get("active") ?? undefined,
  });
  if (!parsed.success) {
    return new NextResponse("Parámetros inválidos", { status: 400 });
  }

  const rows = await prisma.rentalAsset.findMany({
    where: {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.active ? { isActive: parsed.data.active === "true" } : {}),
    },
    orderBy: [{ type: "asc" }, { size: "asc" }, { name: "asc" }, { code: "asc" }],
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      size: true,
      status: true,
      isActive: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  try {
    const row = await prisma.rentalAsset.create({
      data: {
        type: parsed.data.type,
        name: parsed.data.name,
        code: parsed.data.code?.trim() || null,
        size: parsed.data.size?.trim() || null,
        status: parsed.data.status ?? "AVAILABLE",
        notes: parsed.data.notes?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
      select: {
        id: true,
        type: true,
        name: true,
        code: true,
        size: true,
        status: true,
        isActive: true,
        notes: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}