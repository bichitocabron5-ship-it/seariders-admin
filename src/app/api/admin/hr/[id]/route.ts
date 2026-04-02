// src/app/api/admin/hr/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { EmployeeKind } from "@prisma/client";
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

const Body = z.object({
  code: z.string().trim().min(1).max(40).optional().nullable(),
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  kind: z.nativeEnum(EmployeeKind).optional(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  hireDate: z.string().datetime().optional().nullable(),
  terminationDate: z.string().datetime().optional().nullable(),
  internshipHoursTotal: z.coerce.number().int().min(0).optional().nullable(),
  internshipStartDate: z.string().datetime().optional().nullable(),
  internshipHoursUsed: z.coerce.number().int().min(0).optional().nullable(),
  internshipEndDate: z.string().datetime().optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const previous = await tx.employee.findUnique({
        where: { id },
        select: { fullName: true, kind: true, isActive: true },
      });
      if (!previous) throw new Error("Trabajador no existe");

      const updated = await tx.employee.update({
        where: { id },
        data: {
          ...(b.code !== undefined ? { code: b.code?.trim() || null } : {}),
          ...(b.fullName !== undefined ? { fullName: b.fullName.trim() } : {}),
          ...(b.phone !== undefined ? { phone: b.phone?.trim() || null } : {}),
          ...(b.email !== undefined ? { email: b.email?.trim() || null } : {}),
          ...(b.kind !== undefined ? { kind: b.kind } : {}),
          ...(b.jobTitle !== undefined ? { jobTitle: b.jobTitle?.trim() || null } : {}),
          ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
          ...(b.note !== undefined ? { note: b.note?.trim() || null } : {}),
          ...(b.hireDate !== undefined ? { hireDate: b.hireDate ? new Date(b.hireDate) : null } : {}),
          ...(b.terminationDate !== undefined ? { terminationDate: b.terminationDate ? new Date(b.terminationDate) : null } : {}),
          ...(b.kind === "INTERN" && {
            internshipHoursTotal: b.internshipHoursTotal ?? null,
            internshipStartDate: b.internshipStartDate
              ? new Date(b.internshipStartDate)
              : null,
            internshipEndDate: b.internshipEndDate
              ? new Date(b.internshipEndDate)
              : null,
          }),

          ...(b.kind !== undefined && b.kind !== "INTERN" && {
            internshipHoursTotal: null,
            internshipStartDate: null,
            internshipEndDate: null,
          }),
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
          hireDate: true,
          terminationDate: true,
          internshipHoursTotal: true,
          internshipHoursUsed: true,
          internshipStartDate: true,
          internshipEndDate: true,
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

      await syncMonitorFromEmployee(tx, previous, {
        fullName: updated.fullName,
        kind: updated.kind,
        isActive: updated.isActive,
      });

      return updated;
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
