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
};

type ChannelLite = {
  id: string;
  name: string;
  commissionEnabled: boolean | null;
  commissionBps: number | null;
};

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export async function GET(req: Request) {
  // auth (BOOTH/STORE/ADMIN)
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

  // --- helpers negocio ---
  const isExtra = (s: Pick<ServiceLite, "category">) => String(s.category ?? "").toUpperCase() === "EXTRA";

  const isAcompanante = (s: Pick<ServiceLite, "code" | "name">) => {
    const c = normalize(String(s.code ?? ""));
    const n = normalize(String(s.name ?? ""));
    return c === "acompañante" || c === "acompanante" || n.includes("acompañ");
  };

  const JETSKI_TURISTA_HINTS = ["jetski turista", "turista"];
  const isJetskiTurista = (s: Pick<ServiceLite, "code" | "name">) => {
    const n = normalize(String(s.name ?? ""));
    const c = normalize(String(s.code ?? ""));
    return JETSKI_TURISTA_HINTS.some((h) => n.includes(h)) || c.includes("turista");
  };

  // “Jetski normal” (excluyendo turista)
  const isJetskiStd = (s: Pick<ServiceLite, "code" | "name">) => {
    if (isJetskiTurista(s)) return false;
    const n = normalize(String(s.name ?? ""));
    const c = normalize(String(s.code ?? ""));
    return n.includes("jetski") || c === "jetski";
  };

  // canales booth
  const boothAllowed = ["karim", "nomad", "port olímpic", "port olimpic", "portolimpic"];
  const isBoothChannel = (c: Pick<ChannelLite, "name">) =>
    boothAllowed.some((x) => normalize(String(c.name ?? "")).includes(normalize(x)));

  // --- queries base ---
  const [servicesAll, optionsRaw, prices, channelsAll] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, category: true, isLicense: true, isActive: true },
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
        basePriceCents: true, // legacy
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
        durationMin: true, // legacy extras
        basePriceCents: true,
        validFrom: true,
      },
      orderBy: { validFrom: "desc" },
    }),

    prisma.channel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, commissionEnabled: true, commissionBps: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // --- filtrado servicios por origin ---
  // servicios visibles “generales”
  let servicesVisible = servicesAll.slice();

  if (origin === "STORE") {
    // STORE: no jetski turista, no acompañante
    servicesVisible = servicesVisible.filter((s) => !isJetskiTurista(s) && !isAcompanante(s));
  } else {
    // BOOTH: no extras, y si hay turista, sustituye al jetski normal
    // (quitamos jetski normal, dejamos turista si existe)
    const turista = servicesVisible.find(isJetskiTurista) ?? null;
    servicesVisible = servicesVisible.filter((s) => !isJetskiStd(s));
    if (turista && !servicesVisible.some((s) => s.id === turista.id)) servicesVisible.push(turista);
  }

  const servicesMain = servicesVisible.filter((s) => !isExtra(s));
  let servicesExtra = servicesVisible.filter((s) => isExtra(s));

  if (origin === "BOOTH") {
    servicesExtra = []; // booth sin extras
  }

  // --- canales por origin ---
  let channels = channelsAll.slice();
  if (origin === "BOOTH") channels = channels.filter(isBoothChannel);
  else channels = channels.filter((c) => !isBoothChannel(c));

  // --- price map vigente ---
  // prioridad: el primero encontrado (viene ordenado por validFrom desc)
  const priceMap = new Map<string, number>();
  for (const pr of prices) {
    if (pr.optionId) {
      const k = `${pr.serviceId}:${pr.optionId}`;
      if (!priceMap.has(k)) priceMap.set(k, pr.basePriceCents);
    } else {
      const k = `${pr.serviceId}:null`;
      if (!priceMap.has(k)) priceMap.set(k, pr.basePriceCents);
    }
  }

  // --- options (solo de servicesMain visibles) ---
  const visibleMainIds = new Set(servicesMain.map((s) => s.id));

  const options = optionsRaw
    .filter((o) => visibleMainIds.has(o.serviceId))
    .map((o) => {
      const k = `${o.serviceId}:${o.id}`;
      const real = priceMap.get(k);

      // BOOTH: fallback a legacy basePriceCents si no hay servicePrice
      const boothFallback = origin === "BOOTH" ? (Number(o.basePriceCents ?? 0) || 0) : null;

      const base = real ?? boothFallback; // STORE => real o null, BOOTH => real o legacy
      return {
        ...o,
        basePriceCents: base,
        hasPrice: base != null && base > 0,
      };
    });

  // --- extras: precio por serviceId (solo STORE) ---
  const extraPriceByServiceId: Record<string, number | null> = {};
  for (const s of servicesExtra) {
    const k = `${s.id}:null`;
    extraPriceByServiceId[s.id] = priceMap.get(k) ?? null;
  }

  // --- categorías ---
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

    // compat BOOTH (si tu UI antigua espera "services")
    services: servicesMain,
  });
}
