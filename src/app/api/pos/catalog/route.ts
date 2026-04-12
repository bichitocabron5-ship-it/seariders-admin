// src/app/api/pos/catalog/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Q = z.object({
  origin: z.enum(["STORE", "BOOTH"]),
});

type ServiceLite = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
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
        visibleInStore: true,
        visibleInBooth: true,
        allowsPromotions: true,
        commissionEnabled: true,
        commissionBps: true,
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

  const priceMap = new Map<string, number>();
  for (const pr of prices) {
    if (pr.optionId) {
      const key = `${pr.serviceId}:${pr.optionId}`;
      if (!priceMap.has(key)) priceMap.set(key, pr.basePriceCents);
    } else {
      const key = `${pr.serviceId}:null`;
      if (!priceMap.has(key)) priceMap.set(key, pr.basePriceCents);
    }
  }

  const visibleMainIds = new Set(servicesMain.map((s) => s.id));

  const options = optionsRaw
    .filter((o) => visibleMainIds.has(o.serviceId))
    .map((o) => {
      const key = `${o.serviceId}:${o.id}`;
      const real = priceMap.get(key);
      const boothFallback = origin === "BOOTH" ? (Number(o.basePriceCents ?? 0) || 0) : null;
      const base = real ?? boothFallback;

      return {
        ...o,
        basePriceCents: base,
        hasPrice: base != null && base > 0,
      };
    });

  const extraPriceByServiceId: Record<string, number | null> = {};
  for (const s of servicesExtra) {
    const key = `${s.id}:null`;
    extraPriceByServiceId[s.id] = priceMap.get(key) ?? null;
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
