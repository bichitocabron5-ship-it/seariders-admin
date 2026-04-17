// src/app/api/admin/assets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import {
  AssetMaintenanceProfile,
  AssetMeterType,
  AssetStatus,
  AssetType,
  Prisma,
} from "@prisma/client";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}

// GET /api/admin/assets?type=BOAT&status=OPERATIONAL&q=nico
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const typeRaw = (url.searchParams.get("type") ?? "").trim();
  const statusRaw = (url.searchParams.get("status") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Prisma.AssetWhereInput = {};
  if (typeRaw && (Object.values(AssetType) as string[]).includes(typeRaw)) where.type = typeRaw as AssetType;
  if (statusRaw && (Object.values(AssetStatus) as string[]).includes(statusRaw)) where.status = statusRaw as AssetStatus;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { plate: { contains: q, mode: "insensitive" } },
      { chassisNumber: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.asset.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      type: true,
      status: true,
      platformUsage: true,
      maintenanceProfile: true,
      meterType: true,
      name: true,
      code: true,
      model: true,
      year: true,
      plate: true,
      chassisNumber: true,
      maxPax: true,
      note: true,
      isMotorized: true,

      currentHours: true,
      lastServiceHours: true,
      serviceIntervalHours: true,
      serviceWarnHours: true,

      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ assets: rows });
}

const CreateBody = z.object({
  type: z.nativeEnum(AssetType),
  status: z.nativeEnum(AssetStatus).optional(),
  platformUsage: z.enum(["CUSTOMER_ASSIGNABLE", "RUN_BASE_ONLY", "HIDDEN"]).optional(),
  maintenanceProfile: z.nativeEnum(AssetMaintenanceProfile).optional(),
  meterType: z.nativeEnum(AssetMeterType).optional(),

  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(30).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  plate: z.string().trim().max(30).optional().nullable(),
  chassisNumber: z.string().trim().max(80).optional().nullable(),
  maxPax: z.number().int().min(1).max(100).optional().nullable(),
  isMotorized: z.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),

  currentHours: z.number().optional().nullable(),
  lastServiceHours: z.number().optional().nullable(),
  serviceIntervalHours: z.number().optional(),
  serviceWarnHours: z.number().optional(),
});

const PatchBody = CreateBody.partial().extend({
  id: z.string().trim().optional().nullable(),
  originalCode: z.string().trim().min(1).max(30).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const created = await prisma.asset.create({
      data: {
        type: b.type,
        status: b.status ?? AssetStatus.OPERATIONAL,
        platformUsage: b.platformUsage ?? "CUSTOMER_ASSIGNABLE",
        maintenanceProfile: b.maintenanceProfile ?? AssetMaintenanceProfile.OPERATIONAL,
        meterType: b.meterType ?? AssetMeterType.HOURS,

        name: b.name,
        code: b.code ?? null,
        model: b.model ?? null,
        year: b.year ?? null,
        plate: b.plate ?? null,
        chassisNumber: b.chassisNumber ?? null,
        maxPax: b.maxPax ?? null,
        note: b.note ?? null,

        currentHours:
          (b.meterType ?? AssetMeterType.HOURS) === AssetMeterType.NONE
            ? null
            : b.currentHours ?? null,
        lastServiceHours:
          (b.meterType ?? AssetMeterType.HOURS) === AssetMeterType.NONE
            ? null
            : b.lastServiceHours ?? null,
        ...(typeof b.serviceIntervalHours === "number" ? { serviceIntervalHours: b.serviceIntervalHours } : {}),
        ...(typeof b.serviceWarnHours === "number" ? { serviceWarnHours: b.serviceWarnHours } : {}),
        isMotorized: b.isMotorized ?? false,
      },
      select: {
        id: true,
        type: true,
        status: true,
        platformUsage: true,
        maintenanceProfile: true,
        meterType: true,
        name: true,
        code: true,
        model: true,
        year: true,
        plate: true,
        chassisNumber: true,
        maxPax: true,
        note: true,
        isMotorized: true,

        currentHours: true,
        lastServiceHours: true,
        serviceIntervalHours: true,
        serviceWarnHours: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ row: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    // si code unique peta, postgres suele dar mensaje claro; lo devolvemos
    return new NextResponse(msg, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;
  const id = b.id?.trim() || null;
  const originalCode = b.originalCode?.trim() || null;

  if (!id && !originalCode) {
    return NextResponse.json({ error: "Falta id u originalCode para actualizar" }, { status: 400 });
  }

  try {
    const updated = await prisma.asset.update({
      where: id ? { id } : { code: originalCode! },
      data: {
        ...(b.type ? { type: b.type } : {}),
        ...(b.status ? { status: b.status } : {}),
        ...(b.platformUsage ? { platformUsage: b.platformUsage } : {}),
        ...(b.maintenanceProfile ? { maintenanceProfile: b.maintenanceProfile } : {}),
        ...(b.meterType ? { meterType: b.meterType } : {}),
        ...(typeof b.name === "string" ? { name: b.name } : {}),
        ...(b.code !== undefined ? { code: b.code } : {}),
        ...(b.model !== undefined ? { model: b.model } : {}),
        ...(b.year !== undefined ? { year: b.year } : {}),
        ...(b.plate !== undefined ? { plate: b.plate } : {}),
        ...(b.chassisNumber !== undefined ? { chassisNumber: b.chassisNumber } : {}),
        ...(b.maxPax !== undefined ? { maxPax: b.maxPax } : {}),
        ...(b.note !== undefined ? { note: b.note } : {}),
        ...(b.meterType === AssetMeterType.NONE ? { currentHours: null, lastServiceHours: null } : {}),
        ...(b.currentHours !== undefined && b.meterType !== AssetMeterType.NONE ? { currentHours: b.currentHours } : {}),
        ...(b.lastServiceHours !== undefined && b.meterType !== AssetMeterType.NONE ? { lastServiceHours: b.lastServiceHours } : {}),
        ...(typeof b.serviceIntervalHours === "number" ? { serviceIntervalHours: b.serviceIntervalHours } : {}),
        ...(typeof b.serviceWarnHours === "number" ? { serviceWarnHours: b.serviceWarnHours } : {}),
        ...(typeof b.isMotorized === "boolean" ? { isMotorized: b.isMotorized } : {}),
      },
      select: {
        id: true,
        type: true,
        status: true,
        platformUsage: true,
        maintenanceProfile: true,
        meterType: true,
        name: true,
        code: true,
        model: true,
        year: true,
        plate: true,
        chassisNumber: true,
        maxPax: true,
        note: true,
        isMotorized: true,
        currentHours: true,
        lastServiceHours: true,
        serviceIntervalHours: true,
        serviceWarnHours: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ row: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
