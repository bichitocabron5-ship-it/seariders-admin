// src/app/api/admin/assets/[id]/route.ts
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

const PatchBody = z.object({
  type: z.nativeEnum(AssetType).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  platformUsage: z.enum(["CUSTOMER_ASSIGNABLE", "RUN_BASE_ONLY", "HIDDEN"]).optional(),
  maintenanceProfile: z.nativeEnum(AssetMaintenanceProfile).optional(),
  meterType: z.nativeEnum(AssetMeterType).optional(),

  name: z.string().trim().min(1).max(80).optional(),
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const updated = await prisma.asset.update({
      where: { id },
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
