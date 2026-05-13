import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { getCachedAemetBeachForecast } from "@/lib/aemet";
import { sessionOptions, type AppSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ensureSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!["ADMIN", "STORE", "PLATFORM", "BOOTH"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}

export async function GET(req: Request) {
  const unauthorized = await ensureSession();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const result = await getCachedAemetBeachForecast({ forceRefresh });
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function POST() {
  const unauthorized = await ensureSession();
  if (unauthorized) return unauthorized;

  const result = await getCachedAemetBeachForecast({ forceRefresh: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
