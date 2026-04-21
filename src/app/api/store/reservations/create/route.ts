// src/app/api/store/reservations/create/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { createReservationWithItems } from "@/lib/reservations/createReservationWithItems";
import { validateReusableAssetsAvailability } from "@/lib/store-rental-assets";
import { JetskiLicenseMode, PricingTier } from "@prisma/client";

export const runtime = "nodejs";

async function requireStore(): Promise<{ userId: string; role: "STORE" | "ADMIN" } | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId) return null;
  if (session.role !== "STORE" && session.role !== "ADMIN") return null;

  return { userId: session.userId, role: session.role as "STORE" | "ADMIN" };
}

const Body = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerCountry: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerPostalCode: z.string().nullable().optional(),
  customerBirthDate: z.string().datetime().nullable().optional(),
  customerDocType: z.string().nullable().optional(),
  customerDocNumber: z.string().nullable().optional(),
  marketing: z.string().nullable().optional(),
  licenseSchool: z.string().nullable().optional(),
  licenseType: z.string().nullable().optional(),
  licenseNumber: z.string().nullable().optional(),
  channelId: z.string().min(1),
  date: z.string().min(10).max(10),
  time: z
    .preprocess((v) => (v == null ? "" : String(v).trim()), z.string())
    .pipe(z.string().regex(/^\d{2}:\d{2}$/)),

  pax: z.number().int().min(1).max(50),
  isLicense: z.boolean().default(false),
  jetskiLicenseMode: z.nativeEnum(JetskiLicenseMode).optional(),
  pricingTier: z.nativeEnum(PricingTier).optional(),

  manualDiscountCents: z.number().int().min(0).max(1_000_000).optional(),
  manualDiscountReason: z.string().max(200).nullable().optional(),
  discountResponsibility: z.enum(["COMPANY", "PROMOTER", "SHARED"]).optional(),
  promoterDiscountShareBps: z.number().int().min(0).max(10000).optional(),

  // Siempre items (carrito / pack / normal)
  items: z.array(
    z.object({
      serviceId: z.string().min(1), // id o code si quieres, pero ahora mismo es id
      optionId: z.string().min(1), // id o code si quieres, pero ahora mismo es id
      quantity: z.number().int().min(1).max(99),
      pax: z.number().int().min(1).max(50),
      promoCode: z.preprocess(
        (v) => {
          if (v == null) return null;
          const t = String(v).trim().toUpperCase();
          return t.length ? t : null;
        },
        z.string().min(1).max(50).nullable().optional()
      ),
    })
  ).min(1),

  // (opcional) metadata informativa
  packId: z.string().min(1).nullable().optional(),
  companionsCount: z.number().int().min(0).max(20).optional(),

  // Para multi-item (packs y futuro carrito real)
  totalBeforeDiscountsCents: z.number().int().min(0).max(50_000_000).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireStore();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

    const b = parsed.data;

    if (!String(b.customerName ?? "").trim()) {
      return new NextResponse("Nombre requerido", { status: 400 });
    }
    if (!String(b.customerCountry ?? "").trim()) {
      return new NextResponse("País requerido", { status: 400 });
    }

    const items = b.items.map((i) => ({
      serviceIdOrCode: i.serviceId,
      optionIdOrCode: i.optionId,
      quantity: i.quantity,
      pax: i.pax,
      promoCode: i.promoCode ?? null,
    }));

    const pricing =
  items.length === 1
    ? { mode: "QUICK_SINGLE_ITEM" as const }
    : b.totalBeforeDiscountsCents != null
      ? { mode: "PACK_FIXED_TOTAL" as const, totalBeforeDiscountsCents: b.totalBeforeDiscountsCents }
      : { mode: "CART_MULTI_ITEM" as const };

    if (pricing.mode === "PACK_FIXED_TOTAL" && pricing.totalBeforeDiscountsCents <= 0) {
      return new NextResponse("totalBeforeDiscountsCents requerido para multi-item", { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {

      // ===== VALIDACIÓN INVENTARIO REAL (ANTES DE CREAR) =====

      const serviceIds = Array.from(new Set(items.map((i) => i.serviceIdOrCode)));

      const services = await tx.service.findMany({
        where: { id: { in: serviceIds } },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
        },
      });

      const serviceMap = new Map(services.map((s) => [s.id, s]));

      const itemsToValidate = items.map((it) => ({
        quantity: Number(it.quantity ?? 0),
        service: serviceMap.get(it.serviceIdOrCode) ?? null,
      }));

      await validateReusableAssetsAvailability({
        tx,
        items: itemsToValidate,
      });
      
      return createReservationWithItems({
        tx,
        sessionUserId: session.userId,
        input: {
          customerName: b.customerName,
          customerPhone: b.customerPhone ?? null,
          customerEmail: b.customerEmail ?? null,
          customerCountry: b.customerCountry ?? null,
          customerAddress: b.customerAddress ?? null,
          customerPostalCode: b.customerPostalCode ?? null,
          customerBirthDate: b.customerBirthDate ?? null,
          customerDocType: b.customerDocType ?? null,
          customerDocNumber: b.customerDocNumber ?? null,
          marketing: b.marketing ?? null,
          licenseSchool: b.licenseSchool ?? null,
          licenseType: b.licenseType ?? null,
          licenseNumber: b.licenseNumber ?? null,
          channelId: b.channelId,
          date: b.date,
          time: b.time,
          pax: b.pax,
          companionsCount: Number(b.companionsCount ?? 0),
          isLicense: Boolean(b.isLicense),
          jetskiLicenseMode: b.jetskiLicenseMode,
          pricingTier: b.pricingTier,
          manualDiscountCents: b.manualDiscountCents ?? 0,
          manualDiscountReason: b.manualDiscountReason ?? null,
          discountResponsibility: b.discountResponsibility ?? "COMPANY",
          promoterDiscountShareBps: b.promoterDiscountShareBps ?? 0,
          items,
          packId: b.packId ?? null,
          pricing,
        },
      });
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno";
    if (msg.includes("Slot completo") || msg.includes("Sin disponibilidad")) {
      return new NextResponse(msg, { status: 409 });
    }
    console.error("create endpoint error:", e);
    return new NextResponse(msg, { status: 500 });
  }
}


