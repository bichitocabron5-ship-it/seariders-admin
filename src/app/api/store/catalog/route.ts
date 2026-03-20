// src/app/api/store/catalog/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  u.pathname = "/api/pos/catalog";
  u.searchParams.set("origin", "STORE");
  return NextResponse.redirect(u);
}
