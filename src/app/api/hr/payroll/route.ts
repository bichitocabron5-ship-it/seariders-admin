// src/app/api/hr/payroll/route.ts
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

const Query = z.object({
  employeeId: z.string().optional(),
  status: z.nativeEnum(PayrollStatus).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: (url.searchParams.get("status") ?? undefined) as PayrollStatus | undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { employeeId, status, from, to } = parsed.data;

  const rows = await prisma.payrollEntry.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            periodStart: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
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
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          code: true,
          fullName: true,
          kind: true,
          jobTitle: true,
        },
      },
      createdByUserId: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

const Body = z.object({
  employeeId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  status: z.nativeEnum(PayrollStatus).optional().default(PayrollStatus.DRAFT),
  amountCents: z.coerce.number().int().min(0),
  concept: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.payrollEntry.create({
      data: {
        employeeId: b.employeeId,
        periodStart: new Date(b.periodStart),
        periodEnd: new Date(b.periodEnd),
        status: b.status,
        amountCents: b.amountCents,
        concept: b.concept?.trim() || null,
        note: b.note?.trim() || null,
        paidAt: b.paidAt ? new Date(b.paidAt) : null,
        createdByUserId: session.userId,
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
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}