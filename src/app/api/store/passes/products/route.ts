// src/app/api/store/passes/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET() {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.passProduct.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      totalMinutes: true,
      priceCents: true,
      validDays: true,
      service: { select: { id: true, name: true, category: true } },
    },
  });

  return NextResponse.json({ products: rows });
}
