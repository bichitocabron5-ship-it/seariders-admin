import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireBarOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BAR", "ADMIN"].includes(String(session.role))) return null;
  return session;
}

export async function GET() {
  const session = await requireBarOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      code: true,
      kind: true,
      jobTitle: true,
    },
  });

  return NextResponse.json({ ok: true, rows });
}
