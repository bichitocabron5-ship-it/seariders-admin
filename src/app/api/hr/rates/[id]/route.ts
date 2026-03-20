// src/app/api/hr/rates/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { EmployeeRateType } from "@prisma/client";

export const runtime = "nodejs";

async function requireHrOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (["ADMIN", "HR"].includes(session.role as string)) return session;
  return null;
}

const Body = z.object({
  rateType: z.nativeEnum(EmployeeRateType).optional(),
  amountCents: z.coerce.number().int().min(0).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.employeeRate.update({
      where: { id },
      data: {
        ...(b.rateType !== undefined ? { rateType: b.rateType } : {}),
        ...(b.amountCents !== undefined ? { amountCents: b.amountCents } : {}),
        ...(b.effectiveFrom !== undefined ? { effectiveFrom: new Date(b.effectiveFrom) } : {}),
        ...(b.effectiveTo !== undefined ? { effectiveTo: b.effectiveTo ? new Date(b.effectiveTo) : null } : {}),
        ...(b.note !== undefined ? { note: b.note?.trim() || null } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        rateType: true,
        amountCents: true,
        effectiveFrom: true,
        effectiveTo: true,
        note: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}