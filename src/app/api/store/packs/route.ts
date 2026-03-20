// src/app/api/store/packs/route.ts
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
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  if (!serviceId) return NextResponse.json({ error: "serviceId requerido" }, { status: 400 });

  const pack = await prisma.pack.findFirst({
    where: { serviceId },
    select: {
      id: true,
      code: true,
      name: true,
      minPax: true,
      maxPax: true,
      pricePerPersonCents: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          quantity: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true, paxMax: true } },
        },
      },
    },
  });

  if (!pack) return NextResponse.json({ ok: true, pack: null });

  return NextResponse.json({ ok: true, pack });
}
