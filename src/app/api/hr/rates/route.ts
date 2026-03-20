// src/app/api/hr/rates/route.ts
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

const Query = z.object({
  employeeId: z.string().optional(),
  rateType: z.nativeEnum(EmployeeRateType).optional(),
});

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    rateType: (url.searchParams.get("rateType") ?? undefined) as EmployeeRateType | undefined,
  });

  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { employeeId, rateType } = parsed.data;

  const rows = await prisma.employeeRate.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(rateType ? { rateType } : {}),
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      employeeId: true,
      rateType: true,
      amountCents: true,
      effectiveFrom: true,
      effectiveTo: true,
      note: true,
      createdAt: true,
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
  rateType: z.nativeEnum(EmployeeRateType),
  amountCents: z.coerce.number().int().min(0),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.employeeRate.create({
      data: {
        employeeId: b.employeeId,
        rateType: b.rateType,
        amountCents: b.amountCents,
        effectiveFrom: new Date(b.effectiveFrom),
        effectiveTo: b.effectiveTo ? new Date(b.effectiveTo) : null,
        note: b.note?.trim() || null,
        createdByUserId: session.userId,
      },
      select: {
        id: true,
        employeeId: true,
        rateType: true,
        amountCents: true,
        effectiveFrom: true,
        effectiveTo: true,
        note: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
