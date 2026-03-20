// src/app/api/admin/catalog/services
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(40),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),

  // flags (solo si existen en tu Prisma; si alguno no existe, bÃ³rralo del schema y del select)
  requiresPlatform: z.boolean().optional(),
  requiresJetski: z.boolean().optional(),
  requiresMonitor: z.boolean().optional(),
  isLicense: z.boolean().optional(),
  maxPax: z.number().int().min(1).max(30).nullable().optional(),
});

function makeServiceCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_") // letras/nÃºmeros -> _
    .replace(/^_+|_+$/g, "")
    .slice(0, 40); // por si quieres limitar
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      isActive: true,

      // âš ï¸ quita los que no existan en tu modelo
      requiresPlatform: true,
      requiresJetski: true,
      requiresMonitor: true,
      isLicense: true,
    },
  });

  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });
if (parsed.data.category === "EXTRA") {
  // Extras: sin reglas â€œoperativasâ€ (si quieres, fuerza todo a false)
  // y cualquier maxPax/sortOrder si no los usas, lo ignoras.
}

const baseCode = makeServiceCode(parsed.data.name);
let code = baseCode || `SVC_${Date.now()}`;

// si ya existe, le aÃ±adimos sufijo incremental
for (let i = 2; i < 50; i++) {
  const exists = await prisma.service.findUnique({ where: { code }, select: { id: true } });
  if (!exists) break;
  code = `${baseCode}_${i}`;
}
  
  const createData: Prisma.ServiceCreateInput = {
    code, // âœ… imprescindible
    name: parsed.data.name,
    category: parsed.data.category,
    isActive: parsed.data.isActive ?? true,

    ...(parsed.data.requiresPlatform !== undefined ? { requiresPlatform: parsed.data.requiresPlatform } : {}),
    ...(parsed.data.requiresJetski !== undefined ? { requiresJetski: parsed.data.requiresJetski } : {}),
    ...(parsed.data.requiresMonitor !== undefined ? { requiresMonitor: parsed.data.requiresMonitor } : {}),
    ...(parsed.data.isLicense !== undefined ? { isLicense: parsed.data.isLicense } : {}),
  };

  const created = await prisma.service.create({
    data: createData,
    select: { id: true },
  });

  return NextResponse.json({ id: created.id });
}

