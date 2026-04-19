// src/app/api/store/discounts/preview/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JetskiLicenseMode, Prisma } from "@prisma/client";
import { computeAutoDiscountDetail, listPromotionOptions, type DiscountItem } from "@/lib/discounts";
import { resolvePricingTierForJetskiMode } from "@/lib/jetski-license";
import { findActiveServicePrice } from "@/lib/service-pricing";

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
  channelId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  pax: z.number().int().min(1).max(30).default(1),
  jetskiLicenseMode: z.nativeEnum(JetskiLicenseMode).optional(),
  customerCountry: NullableCountry.optional(), // "ES" | null
  promoCode: z.preprocess(
    (v) => {
      if (v == null) return null;
      const t = String(v).trim().toUpperCase();
      return t.length ? t : null;
    },
    z.string().min(1).max(50).nullable().optional()
  ),
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

function isMissingChannelOptionPriceTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.modelName ?? "") === "ChannelOptionPrice"
  );
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

    const { serviceId, optionId, channelId, quantity, customerCountry, promoCode } = parsed.data;

    // 1) option
    const opt = await prisma.serviceOption.findUnique({
      where: { id: optionId },
      select: { id: true, serviceId: true, durationMinutes: true },
    });
    if (!opt) return new NextResponse("Opción no existe", { status: 404 });
    if (opt.serviceId !== serviceId) return new NextResponse("Opción no pertenece al servicio", { status: 400 });

    // 2) precio vigente por optionId (nuevo) o durationMin (legacy)
    const now = new Date();

    const channel = channelId
      ? await prisma.channel.findUnique({
          where: { id: channelId },
          select: { id: true, name: true, allowsPromotions: true },
        })
      : null;
    const promotionsEnabled = channel ? Boolean(channel.allowsPromotions) : true;

    // 3) categoría
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { category: true, name: true },
    });
    const pricingTier =
      String(svc?.category ?? "").toUpperCase() === "JETSKI"
        ? resolvePricingTierForJetskiMode(parsed.data.jetskiLicenseMode)
        : "STANDARD";
    const price = await findActiveServicePrice(prisma, {
      serviceId,
      optionId,
      durationMinutes: Number(opt.durationMinutes ?? 30),
      now,
      pricingTier,
    });

    if (!price) return new NextResponse("No hay precio vigente para esta opción.", { status: 400 });
    const baseTotalCents = Number(price.basePriceCents || 0) * quantity;

    // 4) descuento (solo principal)
    const item: DiscountItem = {
      serviceId,
      optionId,
      category: svc?.category ?? null,
      isExtra: false,
      lineBaseCents: baseTotalCents,
      quantity,
    };

    const detail = await computeAutoDiscountDetail({
      when: now,
      item,
      promoCode: promoCode ?? null,
      customerCountry: customerCountry ?? null,
      promotionsEnabled,
    });
    const availablePromos = await listPromotionOptions({
      when: now,
      item,
      customerCountry: customerCountry ?? null,
      promotionsEnabled,
    });

    const autoDiscountCents = Number(detail.discountCents || 0);
    const finalTotalCents = Math.max(0, baseTotalCents - autoDiscountCents);

    const channelOptionPrice = channel
      ? await prisma.channelOptionPrice.findUnique({
          where: {
            channelId_optionId: {
              channelId: channel.id,
              optionId,
            },
          },
          select: { priceCents: true, isActive: true },
        }).catch((error: unknown) => {
          if (isMissingChannelOptionPriceTable(error)) return null;
          throw error;
        })
      : null;

    const start = fmtHM(detail.rule?.startTimeMin ?? null);
    const end = fmtHM(detail.rule?.endTimeMin ?? null);

    const reason = detail.rule
      ? [
          detail.rule.name,
          detail.rule.code ? `código:${detail.rule.code}` : null,
          detail.rule.requiresCountry ? `req:${detail.rule.requiresCountry}` : null,
          detail.rule.excludeCountry ? `exc:${detail.rule.excludeCountry}` : null,
          start || end ? `${start ?? "-"}-${end ?? "-"}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    return NextResponse.json({
      baseTotalCents,
      autoDiscountCents,
      finalTotalCents,
      pricingTier,
      pricingMeta: {
        pricingTier,
        unitPriceCents: Number(price.basePriceCents || 0),
        quantity,
        modeLabel:
          pricingTier === "RESIDENT"
            ? "Tarifa residente / llave verde"
            : "Tarifa estándar / llave amarilla o sin licencia",
      },
      reason,
      channelPricingSummary:
        channel && channelOptionPrice?.isActive
          ? {
              channelName: channel.name,
              basePriceCents: baseTotalCents,
              referencePriceCents: Number(channelOptionPrice.priceCents ?? 0) * quantity,
              optionLabel: `${opt.durationMinutes} min · ${parsed.data.pax} pax`,
            }
          : null,
      availablePromos: availablePromos.map((promo) => ({
        code: promo.code,
        name: promo.name,
        kind: promo.kind,
        value: promo.value,
        discountCents: promo.discountCents,
      })),
      appliedRule: detail.rule
        ? { id: detail.rule.id, name: detail.rule.name, code: detail.rule.code ?? null }
        : null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}
