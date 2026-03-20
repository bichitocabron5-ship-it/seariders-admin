// src/app/api/hr/payroll/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PayrollStatus } from "@prisma/client";

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
  status: z.nativeEnum(PayrollStatus).optional(),
  amountCents: z.coerce.number().int().min(0).optional(),
  concept: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
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
    const row = await prisma.payrollEntry.update({
      where: { id },
      data: {
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.amountCents !== undefined ? { amountCents: b.amountCents } : {}),
        ...(b.concept !== undefined ? { concept: b.concept?.trim() || null } : {}),
        ...(b.note !== undefined ? { note: b.note?.trim() || null } : {}),
        ...(b.paidAt !== undefined ? { paidAt: b.paidAt ? new Date(b.paidAt) : null } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        amountCents: true,
        concept: true,
        note: true,
        paidAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}