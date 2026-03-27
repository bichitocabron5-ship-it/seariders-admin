// src/app/api/bar/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireBarOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "BAR") return session;
  return null;
}

export async function GET() {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.barCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      products: {
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          salePriceCents: true,
          vatRate: true,
          controlsStock: true,
          currentStock: true,
          minStock: true,
          unitLabel: true,
          staffEligible: true,
          staffPriceCents: true,
          promotions: {
            where: { isActive: true },
            select: {
              id: true,
              type: true,
              exactQty: true,
              fixedTotalCents: true,
              buyQty: true,
              payQty: true,
              isActive: true,
              startsAt: true,
              endsAt: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    rows,
  });
}
