// src/app/api/store/discounts/preview/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computeAutoDiscountDetail, type DiscountItem } from "@/lib/discounts";

export const runtime = "nodejs";

const NullableCountry = z.preprocess(
  (v) => {
    if (v == null) return null;
    const t = String(v).trim().toUpperCase();
    return t.length ? t : null;
  },
  z.string().length(2).nullable()
);

const Body = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  pax: z.number().int().min(1).max(30).default(1),
  customerCountry: NullableCountry.optional(), // "ES" | null
  promoCode: z.string().min(1).max(50).nullable().optional(),
});

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtHM(min: number | null) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos invÃ¡lidos", { status: 400 });

    const { serviceId, optionId, quantity, customerCountry, promoCode } = parsed.data;

    // 1) option
    const opt = await prisma.serviceOption.findUnique({
      where: { id: optionId },
      select: { id: true, serviceId: true, durationMinutes: true },
    });
    if (!opt) return new NextResponse("OpciÃ³n no existe", { status: 404 });
    if (opt.serviceId !== serviceId) return new NextResponse("OpciÃ³n no pertenece al servicio", { status: 400 });

    // 2) precio vigente por optionId (nuevo) o durationMin (legacy)
    const now = new Date();

    const price = await prisma.servicePrice.findFirst({
      where: {
        serviceId,
        isActive: true,
        validFrom: { lte: now },
        AND: [
          {
            OR: [
              { optionId: optionId }, // âœ… principal moderno
              { optionId: null, durationMin: opt.durationMinutes }, // fallback legacy
            ],
          },
          { OR: [{ validTo: null }, { validTo: { gt: now } }] },
        ],
      },
      orderBy: { validFrom: "desc" },
      select: { basePriceCents: true },
    });

    if (!price) return new NextResponse("No hay precio vigente para esta opciÃ³n.", { status: 400 });

    const baseTotalCents = Number(price.basePriceCents || 0) * quantity;

    // 3) categorÃ­a
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { category: true, name: true },
    });

    // 4) descuento (solo principal)
    const item: DiscountItem = {
      serviceId,
      optionId,
      category: svc?.category ?? null,
      isExtra: false,
      lineBaseCents: baseTotalCents,
    };

    const detail = await computeAutoDiscountDetail({
      when: now,
      item,
      promoCode: promoCode ?? null,
      customerCountry: customerCountry ?? null,
    });

    const autoDiscountCents = Number(detail.discountCents || 0);
    const finalTotalCents = Math.max(0, baseTotalCents - autoDiscountCents);

    const start = fmtHM(detail.rule?.startTimeMin ?? null);
    const end = fmtHM(detail.rule?.endTimeMin ?? null);

    const reason = detail.rule
      ? [
          detail.rule.name,
          detail.rule.code ? `cÃ³digo:${detail.rule.code}` : null,
          detail.rule.requiresCountry ? `req:${detail.rule.requiresCountry}` : null,
          detail.rule.excludeCountry ? `exc:${detail.rule.excludeCountry}` : null,
          start || end ? `${start ?? "â€”"}â€“${end ?? "â€”"}` : null,
        ]
          .filter(Boolean)
          .join(" Â· ")
      : null;

    return NextResponse.json({
      baseTotalCents,
      autoDiscountCents,
      finalTotalCents,
      reason,
      appliedRule: detail.rule
        ? { id: detail.rule.id, name: detail.rule.name, code: detail.rule.code ?? null }
        : null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}

