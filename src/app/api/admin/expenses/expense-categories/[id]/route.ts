// src/app/api/admin/expenses/expense-categories/[id]/route.ts
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
    } catch {}
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
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = parsed.data;

  try {
    const row = await prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(b.name !== undefined ? { name: normalizeText(b.name) ?? "" } : {}),
        ...(b.code !== undefined ? { code: normalizeText(b.code) || null } : {}),
        ...(b.description !== undefined
          ? { description: normalizeText(b.description) || null }
          : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
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