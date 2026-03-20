// src/lib/discounts.ts
import { prisma } from "@/lib/prisma";

export type DiscountItem = {
  serviceId: string;
  optionId: string | null;
  category: string | null;
  isExtra: boolean;
  lineBaseCents: number; // base comisionable / PVP base del item (sin extras si no toca)
};

type Scope = "ALL" | "CATEGORY" | "SERVICE" | "OPTION";
type Kind = "PERCENT" | "FIXED";
type CountryScope = "ANY" | "ES_ONLY" | "NON_ES_ONLY";

type DiscountRuleLite = {
  id: string;
  name: string;
  code: string | null;
  scope: Scope;
  kind: Kind;
  value: number;
  category: string | null;
  serviceId: string | null;
  optionId: string | null;
  requiresCountry: string | null;
  excludeCountry: string | null;
  countryScope: CountryScope | null;
  startTimeMin: number | null;
  endTimeMin: number | null;
  validFrom: Date;
  validTo: Date | null;
  daysOfWeek: number[];
  appliesToExtras: boolean;
};

// 1=Lunes ... 7=Domingo
function dayOfWeek1to7(d: Date) {
  const js = d.getDay(); // 0 dom .. 6 sáb
  return js === 0 ? 7 : js;
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function scopePriority(s: Scope) {
  switch (s) {
    case "OPTION":
      return 4;
    case "SERVICE":
      return 3;
    case "CATEGORY":
      return 2;
    case "ALL":
    default:
      return 1;
  }
}

function isInTimeWindow(min: number, start: number | null, end: number | null) {
  // Sin restricción
  if (start == null && end == null) return true;
  if (start != null && end == null) return min >= start;
  if (start == null && end != null) return min < end;
  return min >= start! && min < end!;
}

function ruleMatchesItem(rule: DiscountRuleLite, item: DiscountItem) {
  const scope = rule.scope;

  if (scope === "ALL") return true;

  if (scope === "CATEGORY") {
    if (!rule.category) return false;
    return item.category != null && item.category === rule.category;
  }

  if (scope === "SERVICE") {
    if (!rule.serviceId) return false;
    return item.serviceId === rule.serviceId;
  }

  // OPTION
  if (scope === "OPTION") {
    if (!rule.optionId) return false;
    return item.optionId != null && item.optionId === rule.optionId;
  }

  return false;
}

function computeDiscountForItem(rule: DiscountRuleLite, itemBaseCents: number) {
  const kind = rule.kind;
  const value = Number(rule.value ?? 0);
  if (itemBaseCents <= 0) return 0;
  
  if (kind === "FIXED") {
    const final = Math.max(0, value);
    return Math.max(0, itemBaseCents - final);
  }

  // PERCENT: value 0..100
  const pct = Math.max(0, Math.min(100, value));
  return Math.round(itemBaseCents * (pct / 100));
}

export type DiscountExplain = {
  discountCents: number;
  rule: {
    id: string;
    name: string;
    code: string | null;
    scope: Scope;
    kind: Kind;
    value: number;
    requiresCountry: string | null;
    excludeCountry: string | null;
    countryScope: "ANY" | "ES_ONLY" | "NON_ES_ONLY" | null;
    startTimeMin: number | null;
    endTimeMin: number | null;
    validFrom: Date;
    validTo: Date | null;
} | null;
}

function normalizeCountryIso(v: string | null | undefined) {
  const t = String(v ?? "").trim().toUpperCase();
  return t.length ? t : null;
}

export async function computeAutoDiscountDetail(args: {
  when: Date;
  item: DiscountItem;              // 👈 SOLO principal
  promoCode?: string | null;
  customerCountry?: string | null;
}): Promise<DiscountExplain> {
  const { when, item, promoCode, customerCountry } = args;
  const country = normalizeCountryIso(customerCountry);

  if (!item) return { discountCents: 0, rule: null };

  const now = when;
  const dow = dayOfWeek1to7(now);
  const min = minutesOfDay(now);

  const codeFilter = promoCode
    ? { OR: [{ code: promoCode }, { code: null }] }
    : { code: null };

  const rules = await prisma.discountRule.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }, codeFilter],
    },
    orderBy: { validFrom: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      scope: true,
      kind: true,
      value: true,
      category: true,
      serviceId: true,
      optionId: true,
      requiresCountry: true,
      excludeCountry: true,
      countryScope: true,
      startTimeMin: true,
      endTimeMin: true,
      validFrom: true,
      validTo: true,
      daysOfWeek: true,
      appliesToExtras: true,
    },
  });

  if (!rules.length) return { discountCents: 0, rule: null };

  const candidates = (rules as DiscountRuleLite[]).filter((r) => {
    if (Array.isArray(r.daysOfWeek) && r.daysOfWeek.length > 0) {
      if (!r.daysOfWeek.includes(dow)) return false;
    }
    if (!isInTimeWindow(min, r.startTimeMin ?? null, r.endTimeMin ?? null)) return false;

    const req = normalizeCountryIso(r.requiresCountry);
    const exc = normalizeCountryIso(r.excludeCountry);
    const scope: CountryScope = r.countryScope ?? "ANY";

    if (scope === "ES_ONLY" && country !== "ES") return false;
    if (scope === "NON_ES_ONLY" && (!country || country === "ES")) return false;

    if (req) {
      if (!country) return false;
      if (country !== req) return false;
    }
    if (exc) {
      if (country && country === exc) return false;
    }

    return true;
  });

  if (!candidates.length) return { discountCents: 0, rule: null };

  const codeRules = promoCode
    ? candidates.filter((r) => (r.code ?? null) === promoCode)
    : [];
  const autoRules = candidates.filter((r) => (r.code ?? null) == null);

  const pickBest = (pool: DiscountRuleLite[]) => {
    let best: DiscountRuleLite | null = null;
    let bestScore = -1;
    let bestDiscount = 0;

    for (const r of pool) {
      if (!r.appliesToExtras && item.isExtra) continue; // (principal => isExtra false)
      if (!ruleMatchesItem(r, item)) continue;

      const discount = computeDiscountForItem(r, Number(item.lineBaseCents || 0));
      if (discount <= 0) continue;

      const pri = scopePriority(r.scope);
      const score = pri * 1_000_000 + discount; // scope > descuento

      if (score > bestScore) {
        best = r;
        bestScore = score;
        bestDiscount = discount;
      }
    }

    return { rule: best, discountCents: bestDiscount };
  };

  // Preferencia: si hay promoCode, intentamos reglas con código y si no, automáticas
  let chosen = promoCode ? pickBest(codeRules) : { rule: null, discountCents: 0 };
  if (!chosen.rule) chosen = pickBest(autoRules);

  if (!chosen.rule || chosen.discountCents <= 0) return { discountCents: 0, rule: null };

  return {
    discountCents: chosen.discountCents,
    rule: {
      id: chosen.rule.id,
      name: chosen.rule.name,
      code: chosen.rule.code ?? null,
      scope: chosen.rule.scope as Scope,
      kind: chosen.rule.kind as Kind,
      value: Number(chosen.rule.value ?? 0),
      requiresCountry: chosen.rule.requiresCountry ?? null,
      excludeCountry: chosen.rule.excludeCountry ?? null,
      countryScope: chosen.rule.countryScope ?? null,
      startTimeMin: chosen.rule.startTimeMin ?? null,
      endTimeMin: chosen.rule.endTimeMin ?? null,
      validFrom: chosen.rule.validFrom,
      validTo: chosen.rule.validTo ?? null,
    },
  };
}
