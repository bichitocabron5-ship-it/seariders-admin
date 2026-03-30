import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PatchBody = z.object({
  // Pon aquí tus campos opcionales reales:
  name: z.string().optional(),
  code: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  kind: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().int().optional(),

  scope: z.enum(["ALL", "CATEGORY", "SERVICE", "OPTION"]).optional(),
  category: z.string().nullable().optional(),
  serviceId: z.string().nullable().optional(),
  optionId: z.string().nullable().optional(),

  requiresCountry: z.string().nullable().optional(),
  excludeCountry: z.string().nullable().optional(),

  validFrom: z.string().optional(),          // ISO
  validTo: z.string().nullable().optional(), // ISO|null

  startTimeMin: z.number().int().nullable().optional(),
  endTimeMin: z.number().int().nullable().optional(),

  daysOfWeek: z.array(z.number().int()).optional(),
  appliesToExtras: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // auth
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const patch = parsed.data;

  // (opcional) leer current para normalizar scope si hace falta
  const current = await prisma.discountRule.findUnique({
    where: { id },
    select: { scope: true, serviceId: true, optionId: true, category: true },
  });
  if (!current) return new NextResponse("Regla no existe", { status: 404 });

  // 2) Normalización según scope (evita datos mezclados)
  const nextScope = patch.scope ?? current.scope;

  const normalized: Prisma.DiscountRuleUpdateInput = { ...patch };

  if (nextScope === "ALL") {
    normalized.category = null;
    normalized.service = { disconnect: true };
    normalized.option = { disconnect: true };
  } else if (nextScope === "CATEGORY") {
    normalized.service = { disconnect: true };
    normalized.option = { disconnect: true };
    // category se queda
  } else if (nextScope === "SERVICE") {
    normalized.category = null;
    normalized.option = { disconnect: true };
    // serviceId se queda
  } else if (nextScope === "OPTION") {
    normalized.category = null;
    // serviceId + optionId se quedan
  }

  if (patch.serviceId !== undefined) {
    normalized.service = patch.serviceId ? { connect: { id: patch.serviceId } } : { disconnect: true };
  }
  if (patch.optionId !== undefined) {
    normalized.option = patch.optionId ? { connect: { id: patch.optionId } } : { disconnect: true };
  }
  delete (normalized as Record<string, unknown>).serviceId;
  delete (normalized as Record<string, unknown>).optionId;

  // 3) Persistir
  const updated = await prisma.discountRule.update({
    where: { id },
    data: normalized,
  });

  return NextResponse.json({ rule: updated });
}

