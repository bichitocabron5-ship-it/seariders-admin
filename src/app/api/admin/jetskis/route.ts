// src/app/admin/jetskis/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { JetskiStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const Query = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
});

const CreateBody = z.object({
  number: z.number().int().min(1),
  plate: z.string().trim().max(30).optional().nullable(),
  chassisNumber: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  owner: z.string().trim().max(80).optional().nullable(),
  maxPax: z.number().int().min(1).max(50).optional().nullable(),

  status: z.nativeEnum(JetskiStatus).optional(),

  currentHours: z.number().min(0).optional().nullable(),
  lastServiceHours: z.number().min(0).optional().nullable(),
  serviceIntervalHours: z.number().min(1).optional(),
  serviceWarnHours: z.number().min(1).optional(),
});

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const q = (parsed.data.q ?? "").trim();
  const statusRaw = (parsed.data.status ?? "").trim().toUpperCase();
  const status =
    statusRaw && (Object.values(JetskiStatus) as string[]).includes(statusRaw)
      ? (statusRaw as JetskiStatus)
      : null;

  const where: Prisma.JetskiWhereInput = {};
  if (status) where.status = status;

  if (q) {
    const maybeNum = Number(q);
    where.OR = [
      ...(Number.isFinite(maybeNum) ? [{ number: maybeNum }] : []),
      { model: { contains: q, mode: "insensitive" } },
      { plate: { contains: q, mode: "insensitive" } },
      { chassisNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const jetskis = await prisma.jetski.findMany({
    where,
    orderBy: [{ number: "asc" }],
    select: {
      id: true,
      number: true,
      plate: true,
      chassisNumber: true,
      model: true,
      year: true,
      owner: true,
      maxPax: true,
      status: true,
      currentHours: true,
      lastServiceHours: true,
      serviceIntervalHours: true,
      serviceWarnHours: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, jetskis });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const jetski = await prisma.jetski.create({
     data: {
       number: b.number,
       plate: b.plate?.trim() || null,
       chassisNumber: b.chassisNumber?.trim() || null,
       model: b.model?.trim() || null,
       year: b.year ?? null,
       owner: b.owner?.trim() || null,
       maxPax: b.maxPax ?? null,
       status: b.status ?? JetskiStatus.OPERATIONAL,

       currentHours: b.currentHours ?? null,
       lastServiceHours: b.lastServiceHours ?? null,
       serviceIntervalHours: b.serviceIntervalHours ?? 85,
       serviceWarnHours: b.serviceWarnHours ?? 70,
     },
     select: {
       id: true,
       number: true,
       plate: true,
       chassisNumber: true,
       model: true,
       year: true,
       owner: true,
       maxPax: true,
       status: true,
       currentHours: true,
       lastServiceHours: true,
       serviceIntervalHours: true,
       serviceWarnHours: true,
       createdAt: true,
       updatedAt: true,
     },
   });

    return NextResponse.json({ ok: true, jetski });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("number")) {
      return new NextResponse("Ya existe una jetski con ese número", { status: 409 });
    }
    return new NextResponse("Error", { status: 400 });
  }
}
