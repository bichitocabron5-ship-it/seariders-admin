// src/app/api/hr/employees/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

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
  q: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export async function GET(req: Request) {
  const session = await requireHrOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { q, isActive } = parsed.data;

  const rows = await prisma.employee.findMany({
    where: {
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { fullName: { contains: q.trim(), mode: "insensitive" } },
              { code: { contains: q.trim(), mode: "insensitive" } },
              { email: { contains: q.trim(), mode: "insensitive" } },
              { phone: { contains: q.trim(), mode: "insensitive" } },
              { jobTitle: { contains: q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true,
      code: true,
      fullName: true,
      kind: true,
      jobTitle: true,
      isActive: true,
      email: true,
      phone: true,
      hireDate: true,
      terminationDate: true,
      note: true,
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          isActive: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}