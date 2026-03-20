// src/app/api/admin/catalog/services/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Ajustado a tu schema real de Service
const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(40).optional(),
  isActive: z.boolean().optional(),

  // flags reales
  requiresPlatform: z.boolean().optional(),
  requiresJetski: z.boolean().optional(),
  requiresMonitor: z.boolean().optional(),
  isLicense: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(ctx.params); // âœ… aquÃ­ estÃ¡ el fix

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

  const p = parsed.data;
  const data: Prisma.ServiceUpdateInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.category !== undefined) data.category = p.category;
  if (p.isActive !== undefined) data.isActive = p.isActive;
  if (p.requiresPlatform !== undefined) data.requiresPlatform = p.requiresPlatform;
  if (p.requiresJetski !== undefined) data.requiresJetski = p.requiresJetski;
  if (p.requiresMonitor !== undefined) data.requiresMonitor = p.requiresMonitor;
  if (p.isLicense !== undefined) data.isLicense = p.isLicense;

  const updated = await prisma.service.update({
    where: { id }, // âœ… ya no es undefined
    data,
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,
      requiresPlatform: true,
      requiresJetski: true,
      requiresMonitor: true,
      isLicense: true,
    },
  });

  return NextResponse.json({ service: updated });
}


