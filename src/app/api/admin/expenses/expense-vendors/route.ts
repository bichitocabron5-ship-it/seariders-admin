// src/app/api/admin/expenses/expense-vendors/route.ts
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
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(50).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.expenseVendor.findMany({
  orderBy: [{ name: "asc" }],
  select: {
    id: true,
    name: true,
    code: true,
    taxId: true,
    email: true,
    phone: true,
    contactPerson: true,
    note: true,
    isActive: true,
    _count: {
      select: { expenses: true },
    },
    categoryLinks: {
      select: {
        id: true,
        isDefault: true,
        category: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ category: { name: "asc" } }],
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
    const row = await prisma.expenseVendor.create({
      data: {
        name: normalizeText(b.name) ?? "",
        code: normalizeText(b.code) || null,
        taxId: normalizeText(b.taxId) || null,
        email: normalizeText(b.email) || null,
        phone: normalizeText(b.phone) || null,
        contactPerson: normalizeText(b.contactPerson) || null,
        note: normalizeText(b.note) || null,
        isActive: b.isActive ?? true,
        ...(b.categoryIds?.length
          ? {
              categoryLinks: {
                create: b.categoryIds.map((categoryId, index) => ({
                  categoryId,
                  isDefault: index === 0,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        taxId: true,
        email: true,
        phone: true,
        contactPerson: true,
        note: true,
        isActive: true,
        categoryLinks: {
          select: {
            id: true,
            isDefault: true,
            category: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new NextResponse(msg, { status: 400 });
  }
}
