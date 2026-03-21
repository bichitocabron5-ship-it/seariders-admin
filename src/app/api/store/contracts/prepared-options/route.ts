// src/app/api/store/contracts/prepared-options/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { JetskiStatus, AssetStatus, PlatformOperabilityStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET() {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [jetskis, assets] = await Promise.all([
    prisma.jetski.findMany({
      where: {
        status: JetskiStatus.OPERATIONAL,
        operabilityStatus: PlatformOperabilityStatus.OPERATIONAL,
      },
      orderBy: [{ number: "asc" }],
      select: {
        id: true,
        number: true,
        model: true,
        plate: true,
      },
    }),
    prisma.asset.findMany({
      where: {
        status: AssetStatus.OPERATIONAL,
        operabilityStatus: PlatformOperabilityStatus.OPERATIONAL,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        plate: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    jetskis,
    assets,
  });
}