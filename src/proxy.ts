import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas publicas
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/webhooks/meta/whatsapp") ||
    pathname.startsWith("/checkin/") ||
    pathname.startsWith("/api/public/checkin/") ||
    pathname.startsWith("/passes/") ||
    pathname.startsWith("/sign/contracts/") ||
    pathname.startsWith("/api/sign/contracts/") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Si no hay cookie de sesion, fuera
  const hasCookie = req.cookies.get("seariders_session");
  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};
