// src/app/api/admin/expenses/expense-categories/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  if (/[ÃÂâ]/.test(normalized)) {
    try {
      normalized = decodeURIComponent(escape(normalized));
    } catch {
      // Keep original value if decoding fails.
    }
  }

  return normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.expenseCategory.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      _count: {
        select: { expenses: true },
      },
    },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const row = await prisma.expenseCategory.create({
      data: {
        name: normalizeText(b.name) ?? "",
        code: normalizeText(b.code) || null,
        description: normalizeText(b.description) || null,
        isActive: b.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
