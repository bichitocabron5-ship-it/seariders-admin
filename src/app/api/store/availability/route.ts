// src/app/api/store/availability/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { getAvailabilitySnapshot } from "@/lib/public-api/availability";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await requireStoreOrAdmin();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const selectedCategory = String(url.searchParams.get("category") ?? "").trim().toUpperCase() || null;
    const selectedDurationMinutes = Number(url.searchParams.get("durationMinutes") ?? 0);
    const selectedQuantity = Number(url.searchParams.get("quantity") ?? 0);
    if (!date || date.length !== 10) {
      return NextResponse.json({ error: "date requerido (YYYY-MM-DD)" }, { status: 400 });
    }
    return NextResponse.json(
      await getAvailabilitySnapshot({
        date,
        selectedCategory,
        selectedDurationMinutes,
        selectedQuantity,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("CONFIGURATION_REQUIRED:")) {
      return NextResponse.json(
        { error: "CONFIGURATION_REQUIRED", message: message.replace(/^CONFIGURATION_REQUIRED:\s*/, "") },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

