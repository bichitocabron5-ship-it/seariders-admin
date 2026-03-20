// src/app/api/store/reservations/extend-time/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  reservationId: z.string().min(1),
  extraTimeServiceId: z.string().min(1), // ej. "Tiempo extra 15"
  quantity: z.number().int().min(1).max(10).default(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  // Simplemente reutiliza add-item desde frontend (o aquí harías la misma lógica).
  // Para no duplicar lógica, yo lo dejaría como llamada desde el cliente a add-item.
  return NextResponse.json({ ok: true, hint: "Usa /api/store/reservations/add-item con isExtra=true" });
}
