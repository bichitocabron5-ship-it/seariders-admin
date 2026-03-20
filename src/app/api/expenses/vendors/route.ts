// src/app/api/expenses/vendors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdminOrMechanic() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (["ADMIN", "MECHANIC"].includes(session.role as string)) return session;
  return null;
}

export async function GET(req: NextRequest) {
  const session = await requireAdminOrMechanic();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const onlyActive = req.nextUrl.searchParams.get("onlyActive") !== "false";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 100);

  const categoryCode = req.nextUrl.searchParams.get("categoryCode")?.trim() ?? "";
  const categoryId = req.nextUrl.searchParams.get("categoryId")?.trim() ?? "";

  const rows = await prisma.expenseVendor.findMany({
    where: {
      ...(onlyActive ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { taxId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(categoryId
        ? {
            categoryLinks: {
              some: {
                categoryId,
              },
            },
          }
        : {}),
      ...(categoryCode
        ? {
            categoryLinks: {
              some: {
                category: {
                  code: { equals: categoryCode, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      code: true,
      taxId: true,
      isActive: true,
      categoryLinks: {
        select: {
          isDefault: true,
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}