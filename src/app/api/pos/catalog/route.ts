// src/app/api/pos/catalog/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { buildPosCatalog } from "@/lib/public-api/catalog";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.enum(["STORE", "BOOTH"]),
});

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const u = new URL(req.url);
  const parsed = Q.safeParse({ origin: u.searchParams.get("origin") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Falta origin=STORE|BOOTH" }, { status: 400 });
  }

  const origin = parsed.data.origin;
  return NextResponse.json(await buildPosCatalog(origin));
}
