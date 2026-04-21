// src/app/api/pos/catalog/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PricingTier } from "@prisma/client";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.enum(["STORE", "BOOTH"]),
});

type ServiceLite = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  isExternalActivity: boolean;
  isLicense: boolean;
  isActive: boolean;
  visibleInBooth: boolean;
};

function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "BOOTH", "ADMIN"].includes(session.role as string)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const u = new URL(req.url);
  const parsed = Q.safeParse({ origin: u.searchParams.get("origin") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Falta origin=STORE|BOOTH" }, { status: 400 });
  }

  const origin = parsed.data.origin;
  const now = new Date();

  const isExtra = (s: Pick<ServiceLite, "category">) => String(s.category ?? "").toUpperCase() === "EXTRA";

  const isAcompanante = (s: Pick<ServiceLite, "code" | "name">) => {
    const c = normalize(String(s.code ?? ""));
    const n = normalize(String(s.name ?? ""));
    return c === "acompanante" || n.includes("acompan");
  };

  const [servicesAll, optionsRaw, prices, channelsAll] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        isExternalActivity: true,
        isLicense: true,
        isActive: true,
        visibleInBooth: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),

    prisma.serviceOption.findMany({
      where: { isActive: true },
      select: {
        id: true,
        serviceId: true,
        code: true,
        durationMinutes: true,
        paxMax: true,
        contractedMinutes: true,
        basePriceCents: true,
        isActive: true,
        visibleInStore: true,
        visibleInBooth: true,
      },
      orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }],
    }),

    prisma.servicePrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: {
        serviceId: true,
        optionId: true,
        durationMin: true,
        pricingTier: true,
        basePriceCents: true,
        validFrom: true,
      },
      orderBy: { validFrom: "desc" },
    }),

    prisma.channel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        kind: true,
        visibleInStore: true,
        visibleInBooth: true,
        showDiscountPolicyInStore: true,
        showDiscountPolicyInBooth: true,
        allowsPromotions: true,
        commissionEnabled: true,
        commissionBps: true,
        discountResponsibility: true,
        promoterDiscountShareBps: true,
        commissionRules: {
          where: { isActive: true },
          select: {
            serviceId: true,
            commissionPct: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  let servicesVisible = servicesAll.slice();

  if (origin === "STORE") {
    servicesVisible = servicesVisible.filter((s) => !isAcompanante(s));
  } else {
    servicesVisible = servicesVisible.filter((s) => s.visibleInBooth);
  }

  const servicesMain = servicesVisible.filter((s) => !isExtra(s));
  let servicesExtra = servicesVisible.filter((s) => isExtra(s));

  if (origin === "BOOTH") {
    servicesExtra = [];
  }

  let channels = channelsAll.slice();
  if (origin === "BOOTH") channels = channels.filter((c) => c.visibleInBooth);
  else channels = channels.filter((c) => c.visibleInStore);

  const standardPriceMap = new Map<string, number>();
  const residentPriceMap = new Map<string, number>();
  for (const pr of prices) {
    const targetMap = pr.pricingTier === PricingTier.RESIDENT ? residentPriceMap : standardPriceMap;
    if (pr.optionId) {
      const key = `${pr.serviceId}:${pr.optionId}`;
      if (!targetMap.has(key)) targetMap.set(key, pr.basePriceCents);
    } else {
      const key = `${pr.serviceId}:null`;
      if (!targetMap.has(key)) targetMap.set(key, pr.basePriceCents);
    }
  }

  const visibleMainIds = new Set(servicesMain.map((s) => s.id));

  const options = optionsRaw
    .filter((o) => visibleMainIds.has(o.serviceId))
    .filter((o) => (origin === "BOOTH" ? o.visibleInBooth : o.visibleInStore))
    .map((o) => {
      const key = `${o.serviceId}:${o.id}`;
      const standardPriceCents = standardPriceMap.get(key) ?? null;
      const residentPriceCents = residentPriceMap.get(key) ?? null;
      const boothFallback = origin === "BOOTH" ? (Number(o.basePriceCents ?? 0) || 0) : null;
      const base = standardPriceCents ?? boothFallback;

      return {
        ...o,
        basePriceCents: base,
        standardPriceCents,
        residentPriceCents,
        hasPrice: (base != null && base > 0) || (residentPriceCents != null && residentPriceCents > 0),
      };
    });

  const extraPriceByServiceId: Record<string, number | null> = {};
  for (const s of servicesExtra) {
    const key = `${s.id}:null`;
    extraPriceByServiceId[s.id] = standardPriceMap.get(key) ?? null;
  }

  const categoriesMain = uniqSorted(servicesMain.map((s) => String(s.category ?? "")).filter(Boolean));
  const categoriesExtra = uniqSorted(servicesExtra.map((s) => String(s.category ?? "")).filter(Boolean));

  return NextResponse.json({
    origin,
    servicesMain,
    servicesExtra,
    categories: { main: categoriesMain, extra: categoriesExtra },
    options,
    extraPriceByServiceId,
    channels,
    services: servicesMain,
  });
}
