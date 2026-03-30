// src/app/api/admin/discounts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { DiscountKind, DiscountScope } from "@prisma/client";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  code: z.string().trim().min(1).max(50).nullable().optional(), // null/undefined = automático
  isActive: z.boolean().default(true),

  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().min(0).max(10_000_000),

  scope: z.enum(["ALL", "CATEGORY", "SERVICE", "OPTION"]).default("ALL"),
  category: z.string().trim().min(1).max(50).nullable().optional(),
  serviceId: z.string().trim().min(1).nullable().optional(),
  optionId: z.string().trim().min(1).nullable().optional(),

  requiresCountry: z.string().trim().min(2).max(5).nullable().optional(),
  excludeCountry: z.string().trim().min(2).max(5).nullable().optional(),

  validFrom: z.string().optional(), // ISO
  validTo: z.string().nullable().optional(),

  daysOfWeek: z.array(z.number().int().min(1).max(7)).default([]),
  startTimeMin: z.number().int().min(0).max(1439).nullable().optional(),
  endTimeMin: z.number().int().min(0).max(1439).nullable().optional(),

  appliesToExtras: z.boolean().default(false),
});

function normalizeCode(code: string | null | undefined) {
  const c = (code ?? "").trim().toUpperCase();
  return c.length ? c : null;
}

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rules = await prisma.discountRule.findMany({
    orderBy: [{ isActive: "desc" }, { validFrom: "desc" }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      kind: true,
      value: true,
      scope: true,
      category: true,
      serviceId: true,
      optionId: true,
      requiresCountry: true,
      excludeCountry: true,
      validFrom: true,
      validTo: true,
      daysOfWeek: true,
      startTimeMin: true,
      endTimeMin: true,
      appliesToExtras: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 300,
  });

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo ? r.validTo.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const data = parsed.data;

  const code = normalizeCode(data.code ?? null);
  const validFrom = data.validFrom ? new Date(data.validFrom) : new Date();
  const validTo = data.validTo ? new Date(data.validTo) : null;

  // Reglas de coherencia (mínimo)
  if (data.scope === "CATEGORY" && !data.category) {
    return new NextResponse("Si scope=CATEGORY, category es obligatorio", { status: 400 });
  }
  if (data.scope === "SERVICE" && !data.serviceId) {
    return new NextResponse("Si scope=SERVICE, serviceId es obligatorio", { status: 400 });
  }
  if (data.scope === "OPTION" && !data.optionId) {
    return new NextResponse("Si scope=OPTION, optionId es obligatorio", { status: 400 });
  }

  // Si hay horario parcial, exigimos ambos (más claro)
  const hasStart = data.startTimeMin != null;
  const hasEnd = data.endTimeMin != null;
  if (hasStart !== hasEnd) {
    return new NextResponse("Si usas horario, rellena startTimeMin y endTimeMin", { status: 400 });
  }
  if (hasStart && hasEnd && Number(data.endTimeMin) <= Number(data.startTimeMin)) {
    return new NextResponse("endTimeMin debe ser mayor que startTimeMin", { status: 400 });
  }

  // País: evita contradicción absurda
  const reqC = (data.requiresCountry ?? null)?.toUpperCase() ?? null;
  const excC = (data.excludeCountry ?? null)?.toUpperCase() ?? null;
  if (reqC && excC && reqC === excC) {
    return new NextResponse("requiresCountry y excludeCountry no pueden ser iguales", { status: 400 });
  }

  // value: percent 0..100
  if (data.kind === "PERCENT" && (data.value < 0 || data.value > 100)) {
    return new NextResponse("PERCENT debe ser 0..100", { status: 400 });
  }

  try {
    const created = await prisma.discountRule.create({
      data: {
        name: data.name,
        code,
        isActive: data.isActive,

        kind: data.kind as DiscountKind,
        value: data.value,

        scope: data.scope as DiscountScope,
        category: data.category ?? null,
        serviceId: data.serviceId ?? null,
        optionId: data.optionId ?? null,

        requiresCountry: reqC,
        excludeCountry: excC,

        validFrom,
        validTo,

        daysOfWeek: data.daysOfWeek ?? [],
        startTimeMin: data.startTimeMin ?? null,
        endTimeMin: data.endTimeMin ?? null,

        appliesToExtras: data.appliesToExtras ?? false,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id });
  } catch (e: unknown) {
    // Unique code
    const msg = e instanceof Error ? e.message : "Error interno";
    return new NextResponse(msg, { status: 500 });
  }
}

