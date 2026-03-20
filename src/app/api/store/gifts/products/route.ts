// src/app/api/store/gifts/products/route.ts
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

  const rows = await prisma.giftProduct.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      priceCents: true,
      validDays: true,
      service: { select: { id: true, name: true, category: true } },
      option: { select: { id: true, durationMinutes: true} },
    },
  });

  const mapped = rows.map((r) => ({
    ...r,
    name:
      r.name?.trim() ||
      `${r.service.category} Â· ${r.service.name} Â· ${r.option.durationMinutes} min`,
    isActive: true,
  }));

  // keep `rows` for any older clients; `products` is what store UI expects
  return NextResponse.json({ ok: true, rows: mapped, products: mapped });
}

