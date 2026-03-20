// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

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
  employeeId: z.string().min(1).optional().nullable(),
  fullName: z.string().trim().min(1).max(120).optional(),
  username: z.string().trim().min(3).max(50).optional(),
  password: z.string().min(4).max(100).optional(),
  email: z.string().trim().email().max(120).optional().nullable(),
  passportCode: z.string().trim().min(1).max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  roles: z.array(z.nativeEnum(RoleName)).min(1).optional(),
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
      if (b.employeeId) {
        const employee = await tx.employee.findUnique({
          where: { id: b.employeeId },
          select: { id: true, userId: true },
        });
        if (!employee) throw new Error("Employee no existe");
        if (employee.userId && employee.userId !== id) {
          throw new Error("Ese trabajador ya está vinculado a otro usuario");
        }
      }

      const passwordHash =
        b.password !== undefined ? await bcrypt.hash(b.password, 10) : undefined;

      await tx.user.update({
        where: { id },
        data: {
          ...(b.fullName !== undefined ? { fullName: b.fullName.trim() } : {}),
          ...(b.username !== undefined ? { username: b.username.trim() } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          ...(b.email !== undefined ? { email: b.email?.trim() || null } : {}),
          ...(b.passportCode !== undefined
            ? { passportCode: b.passportCode?.trim() || null }
            : {}),
          ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
        },
      });

      if (b.employeeId !== undefined) {
        // quitar cualquier vínculo anterior de este usuario
        await tx.employee.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        // si se eligió un trabajador, vincularlo a este usuario
        if (b.employeeId) {
          await tx.employee.update({
            where: { id: b.employeeId },
            data: { userId: id },
          });
        }
      }

      if (b.roles) {
        const userRoles = await tx.userRole.findMany({
          where: { userId: id },
          select: { roleId: true },
        });

        const existingRoleIds = new Set(userRoles.map((r) => r.roleId));

        const wantedRoles = await tx.role.findMany({
          where: { name: { in: b.roles } },
          select: { id: true, name: true },
        });

        const wantedRoleIds = new Set(wantedRoles.map((r) => r.id));

        for (const ur of userRoles) {
          if (!wantedRoleIds.has(ur.roleId)) {
            await tx.userRole.delete({
              where: {
                userId_roleId: {
                  userId: id,
                  roleId: ur.roleId,
                },
              },
            });
          }
        }

        for (const role of wantedRoles) {
          if (!existingRoleIds.has(role.id)) {
            await tx.userRole.create({
              data: {
                userId: id,
                roleId: role.id,
              },
            });
          }
        }
      }

      const updated = await tx.user.findUnique({
        where: { id },
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

      if (!updated) return null;
      return {
        ...updated,
        employeeId: updated.employee?.id ?? null,
      };
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}