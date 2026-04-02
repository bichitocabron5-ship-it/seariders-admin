// src/app/api/admin/hr/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { EmployeeKind, Prisma } from "@prisma/client";
import { syncMonitorFromEmployee } from "@/lib/monitor-sync";

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

const Query = z.object({
  q: z.string().optional(),
  kind: z.nativeEnum(EmployeeKind).optional(),
  active: z.enum(["true", "false"]).optional(),
});

const Body = z.object({
  code: z.string().trim().min(1).max(40).optional().nullable(),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  kind: z.nativeEnum(EmployeeKind),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  hireDate: z.string().datetime().optional().nullable(),
  terminationDate: z.string().datetime().optional().nullable(),
  internshipHoursTotal: z.coerce.number().int().min(0).optional().nullable(),
  internshipStartDate: z.string().datetime().optional().nullable(),
  internshipEndDate: z.string().datetime().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    active: url.searchParams.get("active") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { q, kind, active } = parsed.data;

  const where: Prisma.EmployeeWhereInput = {};
  if (kind) where.kind = kind;
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  if (q?.trim()) {
    where.OR = [
      { fullName: { contains: q.trim(), mode: "insensitive" } },
      { code: { contains: q.trim(), mode: "insensitive" } },
      { email: { contains: q.trim(), mode: "insensitive" } },
      { phone: { contains: q.trim(), mode: "insensitive" } },
      { jobTitle: { contains: q.trim(), mode: "insensitive" } },
      { note: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const rows = await prisma.employee.findMany({
    where,
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true,
      code: true,
      fullName: true,
      phone: true,
      email: true,
      kind: true,
      jobTitle: true,
      isActive: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          isActive: true,
          passportCode: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const b = parsed.data;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          code: b.code?.trim() || null,
          fullName: b.fullName.trim(),
          phone: b.phone?.trim() || null,
          email: b.email?.trim() || null,
          kind: b.kind,
          jobTitle: b.jobTitle?.trim() || null,
          isActive: b.isActive ?? true,
          note: b.note?.trim() || null,
          hireDate: b.hireDate ? new Date(b.hireDate) : null,
          terminationDate: b.terminationDate ? new Date(b.terminationDate) : null,

          internshipHoursTotal:
            b.kind === "INTERN" ? b.internshipHoursTotal ?? null : null,

          internshipStartDate:
            b.kind === "INTERN" && b.internshipStartDate
              ? new Date(b.internshipStartDate)
              : null,

          internshipEndDate:
            b.kind === "INTERN" && b.internshipEndDate
              ? new Date(b.internshipEndDate)
              : null,
        },
        select: {
          id: true,
          code: true,
          fullName: true,
          phone: true,
          email: true,
          kind: true,
          jobTitle: true,
          isActive: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await syncMonitorFromEmployee(tx, null, {
        fullName: created.fullName,
        kind: created.kind,
        isActive: created.isActive,
      });

      return created;
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
