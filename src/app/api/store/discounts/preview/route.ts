// src/app/api/store/discounts/preview/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JetskiLicenseMode } from "@prisma/client";
import { computeAutoDiscountDetail, listPromotionOptions } from "@/lib/discounts";
import {
  buildStoreDiscountPreview,
  StoreDiscountPreviewError,
} from "@/lib/store-discount-preview";

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
  date: z.string().min(10).max(10).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
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

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

    const { serviceId, optionId, channelId, quantity, pax, customerCountry, promoCode, date, time } = parsed.data;

    const preview = await buildStoreDiscountPreview(
      prisma,
      {
        serviceId,
        optionId,
        channelId,
        quantity,
        customerCountry: customerCountry ?? null,
        promoCode: promoCode ?? null,
        date,
        time,
        pax,
        jetskiLicenseMode: parsed.data.jetskiLicenseMode,
      },
      { computeAutoDiscountDetail, listPromotionOptions }
    );

    return NextResponse.json(preview);
  } catch (e: unknown) {
    if (e instanceof StoreDiscountPreviewError) {
      return new NextResponse(e.message, { status: e.status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error desconocido" }, { status: 500 });
  }
}
