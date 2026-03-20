// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, RoleName } from "@prisma/client";

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
  active: z.enum(["true", "false"]).optional(),
});

const Body = z.object({
  employeeId: z.string().min(1).optional().nullable(),
  fullName: z.string().trim().min(1).max(120),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(4).max(100),
  email: z.string().trim().email().max(120).optional().nullable(),
  passportCode: z.string().trim().min(1).max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  roles: z.array(z.nativeEnum(RoleName)).min(1),
});

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    active: url.searchParams.get("active") ?? undefined,
  });
  if (!parsed.success) return new NextResponse("Query inválida", { status: 400 });

  const { q, active } = parsed.data;

  const where: Prisma.UserWhereInput = {};
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  if (q?.trim()) {
    where.OR = [
      { fullName: { contains: q.trim(), mode: "insensitive" } },
      { username: { contains: q.trim(), mode: "insensitive" } },
      { email: { contains: q.trim(), mode: "insensitive" } },
      { passportCode: { contains: q.trim(), mode: "insensitive" } },
      { employee: { is: { fullName: { contains: q.trim(), mode: "insensitive" } } } },
      { employee: { is: { code: { contains: q.trim(), mode: "insensitive" } } } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ username: "asc" }],
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      passportCode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          id: true,
          code: true,
          fullName: true,
          kind: true,
          isActive: true,
        },
      },
      roles: {
        include: {
          role: true,
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
    const passwordHash = await bcrypt.hash(b.password, 10);

    const row = await prisma.$transaction(async (tx) => {
      if (b.employeeId) {
        const employee = await tx.employee.findUnique({
          where: { id: b.employeeId },
          select: { id: true, userId: true },
        });
        if (!employee) throw new Error("Employee no existe");
        if (employee.userId) throw new Error("Ese trabajador ya tiene usuario");
      }

      const user = await tx.user.create({
        data: {
          fullName: b.fullName.trim(),
          username: b.username.trim(),
          passwordHash,
          email: b.email?.trim() || null,
          passportCode: b.passportCode?.trim() || null,
          isActive: b.isActive ?? true,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          passportCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (b.employeeId) {
        await tx.employee.update({
          where: { id: b.employeeId },
          data: { userId: user.id },
        });
      }

      for (const roleName of b.roles) {
        const role = await tx.role.findUnique({
          where: { name: roleName },
          select: { id: true },
        });
        if (!role) throw new Error(`Role no existe: ${roleName}`);

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }

      const withRoles = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          passportCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              code: true,
              fullName: true,
              kind: true,
              isActive: true,
            },
          },
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      return withRoles;
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}