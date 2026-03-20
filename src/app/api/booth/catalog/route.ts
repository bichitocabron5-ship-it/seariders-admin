// src/app/api/booth/catalog/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const u = new URL(req.url);
  u.pathname = "/api/pos/catalog";
  u.searchParams.set("origin", "BOOTH");
  return NextResponse.redirect(u);
}
