// src/app/api/admin/catalog/services/[id]/options/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const CreateBody = z.object({
  durationMinutes: z.number().int().min(1).max(600),
  paxMax: z.number().int().min(1).max(30),
  contractedMinutes: z.number().int().min(1).max(600).optional(),
  isActive: z.boolean().optional(), // AÑADIR
  // legacy obligatorio en tu schema (aunque ya no sea fuente de verdad)
  // Pon 0 por defecto y listo.  
  basePriceCents: z.number().int().min(0).max(10_000_000).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(ctx.params);

  const options = await prisma.serviceOption.findMany({
    where: { serviceId: id },
    orderBy: [{ durationMinutes: "asc" }, { paxMax: "asc" }],
    select: {
      id: true,
      durationMinutes: true,
      paxMax: true,
      contractedMinutes: true,
      isActive: true,
      basePriceCents: true,
    },
  });

  return NextResponse.json({ options });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(ctx.params);

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const exists = await prisma.serviceOption.findFirst({
    where: { serviceId: id, durationMinutes: parsed.data.durationMinutes, paxMax: parsed.data.paxMax },
    select: { id: true },
  });
  if (exists) return new NextResponse("Ya existe una opción con esa duración y PAX", { status: 400 });

function makeOptionCode(serviceCode: string, durationMinutes: number, paxMax: number) {
  const sc = (serviceCode || "SVC").trim().toUpperCase().replace(/[^\p{L}\p{N}_]+/gu, "_");
  return `${sc}_${durationMinutes}_${paxMax}`.slice(0, 60);
}

  const svc = await prisma.service.findUnique({
  where: { id },
  select: { id: true, category: true, code:true },
});
  if (!svc) return new NextResponse("Servicio no existe", { status: 404 });
  if (svc.category === "EXTRA") return new NextResponse("Un EXTRA no puede tener opciones", { status: 400 });

const baseCode = makeOptionCode(svc.code, parsed.data.durationMinutes, parsed.data.paxMax);
let code = baseCode;

for (let i = 2; i < 50; i++) {
  const exists = await prisma.serviceOption.findUnique({ where: { code }, select: { id: true } });
  if (!exists) break;
  code = `${baseCode}_${i}`;
}

const created = await prisma.serviceOption.create({
  data: {
    serviceId: id,
    code,
    durationMinutes: parsed.data.durationMinutes,
    paxMax: parsed.data.paxMax,
    contractedMinutes: parsed.data.contractedMinutes ?? parsed.data.durationMinutes,
    isActive: parsed.data.isActive ?? true,
    basePriceCents: 0,
  },
  select: {
    id: true,
    code: true,
    durationMinutes: true,
    paxMax: true,
    contractedMinutes: true,
    isActive: true,
  },
});

  return NextResponse.json({ option: created });
}

