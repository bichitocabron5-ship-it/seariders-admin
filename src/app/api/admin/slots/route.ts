// src/app/api/admin/slots/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { buildConfigurationRequiredError, getSlotConfigOrThrow } from "@/lib/slot-config";

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

async function listSlotCategoriesAndLimits() {
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

  const limitsRows = await prisma.slotLimit.findMany({
    select: { category: true, maxUnits: true, updatedAt: true },
    orderBy: { category: "asc" },
  });

  return { allCats, limitsRows, missingCategories: missing };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [policyResult, catalog] = await Promise.allSettled([
    getSlotConfigOrThrow(prisma),
    listSlotCategoriesAndLimits(),
  ]);
  const policy =
    policyResult.status === "fulfilled"
      ? policyResult.value
      : null;
  const {
    allCats,
    limitsRows,
    missingCategories,
  } = catalog.status === "fulfilled"
    ? catalog.value
    : { allCats: [] as string[], limitsRows: [] as Array<{ category: string; maxUnits: number }>, missingCategories: [] as string[] };
  const configurationErrors: string[] = [];

  if (!policy) {
    configurationErrors.push("SlotPolicy no configurado.");
  }
  if (missingCategories.length > 0) {
    configurationErrors.push(`Faltan SlotLimit para: ${missingCategories.join(", ")}`);
  }

  return NextResponse.json({
    ok: true,
    policy,
    categories: allCats.sort((a, b) => a.localeCompare(b, "es")),
    limits: limitsRows,
    configurationRequired: configurationErrors.length > 0,
    configurationErrors,
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

  const policy2 = await getSlotConfigOrThrow(prisma).catch(() => {
    throw buildConfigurationRequiredError("SlotPolicy no configurado.");
  });
  const { allCats, limitsRows, missingCategories } = await listSlotCategoriesAndLimits();

  return NextResponse.json({
    ok: true,
    policy: policy2,
    categories: allCats.sort((a, b) => a.localeCompare(b, "es")),
    limits: limitsRows,
    configurationRequired: missingCategories.length > 0,
    configurationErrors:
      missingCategories.length > 0
        ? [`Faltan SlotLimit para: ${missingCategories.join(", ")}`]
        : [],
  });
}
