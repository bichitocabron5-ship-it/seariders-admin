// src/app/api/admin/slots/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN") return session;
  return null;
}

function normalizeHm(s: string) {
  return String(s ?? "").trim();
}

function isValidHm(hm: string) {
  return /^\d{2}:\d{2}$/.test(hm);
}

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

const PostBody = z.object({
  policy: z.object({
    intervalMinutes: z.number().int().min(5).max(240),
    openTime: z.string().transform(normalizeHm),
    closeTime: z.string().transform(normalizeHm),
  }),
  limits: z.array(
    z.object({
      category: z.string().min(1).transform((s) => String(s).toUpperCase().trim()),
      maxUnits: z.number().int().min(0).max(999),
    })
  ),
});

async function seedPolicyIfMissing() {
  let policy = await prisma.slotPolicy.findFirst();
  if (!policy) {
    policy = await prisma.slotPolicy.create({
      data: { intervalMinutes: 30, openTime: "09:00", closeTime: "20:00" },
    });
  }
  return policy;
}

async function seedLimitsForAllCategories() {
  const cats = await prisma.service.findMany({
    where: { isActive: true },
    select: { category: true },
  });

  const allCats = Array.from(
    new Set(cats.map((s) => String(s.category ?? "").toUpperCase()).filter(Boolean))
  );

  const existing = await prisma.slotLimit.findMany({
    select: { category: true },
  });

  const existingSet = new Set(existing.map((r) => String(r.category).toUpperCase()));
  const missing = allCats.filter((c) => !existingSet.has(c));

  if (missing.length > 0) {
    await prisma.slotLimit.createMany({
      data: missing.map((c) => ({ category: c, maxUnits: c === "JETSKI" ? 10 : 1 })),
      skipDuplicates: true,
    });
  }

  const limitsRows = await prisma.slotLimit.findMany({
    select: { category: true, maxUnits: true, updatedAt: true },
    orderBy: { category: "asc" },
  });

  return { allCats, limitsRows };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const policy = await seedPolicyIfMissing();
  const { allCats, limitsRows } = await seedLimitsForAllCategories();

  return NextResponse.json({
    ok: true,
    policy,
    categories: allCats.sort((a, b) => a.localeCompare(b, "es")),
    limits: limitsRows,
  });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(" · ") }, { status: 400 });
  }

  const { policy, limits } = parsed.data;

  if (!isValidHm(policy.openTime) || !isValidHm(policy.closeTime)) {
    return NextResponse.json({ error: "Horario invalido (HH:mm)" }, { status: 400 });
  }

  const openMin = hmToMinutes(policy.openTime);
  const closeMin = hmToMinutes(policy.closeTime);
  if (closeMin <= openMin) {
    return NextResponse.json({ error: "closeTime debe ser mayor que openTime" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const existingPolicy = await tx.slotPolicy.findFirst();
    if (!existingPolicy) {
      await tx.slotPolicy.create({
        data: {
          intervalMinutes: policy.intervalMinutes,
          openTime: policy.openTime,
          closeTime: policy.closeTime,
        },
      });
    } else {
      await tx.slotPolicy.update({
        where: { id: existingPolicy.id },
        data: {
          intervalMinutes: policy.intervalMinutes,
          openTime: policy.openTime,
          closeTime: policy.closeTime,
        },
      });
    }

    // Upsert limits
    for (const row of limits) {
      await tx.slotLimit.upsert({
        where: { category: row.category },
        create: { category: row.category, maxUnits: row.maxUnits },
        update: { maxUnits: row.maxUnits },
      });
    }
  });

  // refresca (y seed por si en paralelo hay categorias nuevas)
  const policy2 = await seedPolicyIfMissing();
  const { allCats, limitsRows } = await seedLimitsForAllCategories();

  return NextResponse.json({
    ok: true,
    policy: policy2,
    categories: allCats.sort((a, b) => a.localeCompare(b, "es")),
    limits: limitsRows,
  });
}
