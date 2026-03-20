// src/app/api/catalog/services/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Query = z.object({
  kind: z.enum(["MAIN", "EXTRA"]).default("MAIN"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    kind: url.searchParams.get("kind") ?? "MAIN",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Query inválida" }, { status: 400 });
  }

  const { kind } = parsed.data;

  // OJO: Service.category es String ahora mismo (por compatibilidad).
  const where =
    kind === "EXTRA"
      ? { isActive: true, category: "EXTRA" }
      : { isActive: true, category: { not: "EXTRA" } };

  const services = await prisma.service.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });

  return NextResponse.json({ services });
}
