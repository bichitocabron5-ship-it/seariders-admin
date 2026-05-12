import { NextResponse } from "next/server";

import { getCachedAemetBeachForecast } from "@/lib/aemet";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function ensureSession() {
  const session = await requireAdmin();
  if (!session) {
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
