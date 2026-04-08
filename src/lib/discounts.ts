import { prisma } from "@/lib/prisma";

export type DiscountItem = {
  serviceId: string;
  optionId: string | null;
  category: string | null;
  isExtra: boolean;
  lineBaseCents: number;
  quantity?: number;
};

type Scope = "ALL" | "CATEGORY" | "SERVICE" | "OPTION";
type Kind = "PERCENT" | "FIXED" | "FINAL_PRICE";
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

export type DiscountRuleSummary = {
  id: string;
  name: string;
  code: string | null;
  scope: Scope;
  kind: Kind;
  value: number;
  requiresCountry: string | null;
  excludeCountry: string | null;
  countryScope: CountryScope | null;
  startTimeMin: number | null;
  endTimeMin: number | null;
  validFrom: Date;
  validTo: Date | null;
};

export type DiscountPromoOption = DiscountRuleSummary & {
  discountCents: number;
};

export type DiscountExplain = {
  discountCents: number;
  rule: DiscountRuleSummary | null;
};

function dayOfWeek1to7(d: Date) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function scopePriority(scope: Scope) {
  switch (scope) {
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
  if (start == null && end == null) return true;
  if (start != null && end == null) return min >= start;
  if (start == null && end != null) return min < end;
  return min >= start! && min < end!;
}

function normalizeIso(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function ruleMatchesItem(rule: DiscountRuleLite, item: DiscountItem) {
  if (rule.scope === "ALL") return true;

  if (rule.scope === "CATEGORY") {
    return Boolean(rule.category && item.category && rule.category === item.category);
  }

  if (rule.scope === "SERVICE") {
    return Boolean(rule.serviceId && rule.serviceId === item.serviceId);
  }

  if (rule.scope === "OPTION") {
    return Boolean(rule.optionId && item.optionId && rule.optionId === item.optionId);
  }

  return false;
}

function computeDiscountForItem(rule: DiscountRuleLite, item: DiscountItem) {
  const base = Math.max(0, Math.round(item.lineBaseCents));
  const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
  if (base <= 0) return 0;

  if (rule.kind === "FIXED") {
    return Math.max(0, Math.min(base, Math.round(Number(rule.value ?? 0))));
  }

  if (rule.kind === "FINAL_PRICE") {
    const finalUnitPriceCents = Math.max(0, Math.round(Number(rule.value ?? 0)));
    const finalLinePriceCents = finalUnitPriceCents * quantity;
    return Math.max(0, base - Math.min(base, finalLinePriceCents));
  }

  const percent = Math.max(0, Math.min(100, Number(rule.value ?? 0)));
  return Math.round(base * (percent / 100));
}

function toRuleSummary(rule: DiscountRuleLite): DiscountRuleSummary {
  return {
    id: rule.id,
    name: rule.name,
    code: rule.code ?? null,
    scope: rule.scope,
    kind: rule.kind,
    value: Number(rule.value ?? 0),
    requiresCountry: rule.requiresCountry ?? null,
    excludeCountry: rule.excludeCountry ?? null,
    countryScope: rule.countryScope ?? null,
    startTimeMin: rule.startTimeMin ?? null,
    endTimeMin: rule.endTimeMin ?? null,
    validFrom: rule.validFrom,
    validTo: rule.validTo ?? null,
  };
}

async function findApplicableRules(args: {
  when: Date;
  item: DiscountItem;
  customerCountry?: string | null;
  promoCode?: string | null;
  includePromoRules?: boolean;
}) {
  const country = normalizeIso(args.customerCountry);
  const promoCode = normalizeIso(args.promoCode);
  const dow = dayOfWeek1to7(args.when);
  const min = minutesOfDay(args.when);

  const rules = (await prisma.discountRule.findMany({
    where: {
      isActive: true,
      validFrom: { lte: args.when },
      OR: [{ validTo: null }, { validTo: { gt: args.when } }],
    },
    orderBy: [{ validFrom: "desc" }, { updatedAt: "desc" }],
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
  })) as DiscountRuleLite[];

  return rules.filter((rule) => {
    if (promoCode) {
      if (rule.code !== promoCode) return false;
    } else if (rule.code && !args.includePromoRules && rule.scope === "OPTION") {
      return false;
    }
    if (Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dow)) return false;
    if (!isInTimeWindow(min, rule.startTimeMin ?? null, rule.endTimeMin ?? null)) return false;
    if (!rule.appliesToExtras && args.item.isExtra) return false;
    if (!ruleMatchesItem(rule, args.item)) return false;

    const requiredCountry = normalizeIso(rule.requiresCountry);
    const excludedCountry = normalizeIso(rule.excludeCountry);
    const countryScope: CountryScope = rule.countryScope ?? "ANY";

    if (countryScope === "ES_ONLY" && country !== "ES") return false;
    if (countryScope === "NON_ES_ONLY" && (!country || country === "ES")) return false;
    if (requiredCountry && country !== requiredCountry) return false;
    if (excludedCountry && country === excludedCountry) return false;

    return computeDiscountForItem(rule, args.item) > 0;
  });
}

function pickBestRule(pool: DiscountRuleLite[], item: DiscountItem) {
  let best: DiscountRuleLite | null = null;
  let bestDiscount = 0;
  let bestPriority = -1;

  for (const rule of pool) {
    const discount = computeDiscountForItem(rule, item);
    if (discount <= 0) continue;

    const priority = scopePriority(rule.scope);
    if (discount > bestDiscount || (discount === bestDiscount && priority > bestPriority)) {
      best = rule;
      bestDiscount = discount;
      bestPriority = priority;
    }
  }

  return { rule: best, discountCents: bestDiscount };
}

export async function listPromotionOptions(args: {
  when: Date;
  item: DiscountItem;
  customerCountry?: string | null;
  promotionsEnabled?: boolean;
}): Promise<DiscountPromoOption[]> {
  if (args.promotionsEnabled === false) return [];
  const applicableRules = await findApplicableRules({
    when: args.when,
    item: args.item,
    customerCountry: args.customerCountry,
    includePromoRules: true,
  });

  const bestByCode = new Map<string, DiscountPromoOption>();
  for (const rule of applicableRules) {
    const code = normalizeIso(rule.code);
    if (!code || rule.scope !== "OPTION") continue;

    const candidate: DiscountPromoOption = {
      ...toRuleSummary(rule),
      code,
      discountCents: computeDiscountForItem(rule, args.item),
    };

    const current = bestByCode.get(code);
    if (
      !current ||
      candidate.discountCents > current.discountCents ||
      (candidate.discountCents === current.discountCents && scopePriority(candidate.scope) > scopePriority(current.scope))
    ) {
      bestByCode.set(code, candidate);
    }
  }

  return Array.from(bestByCode.values()).sort((a, b) => {
    if (b.discountCents !== a.discountCents) return b.discountCents - a.discountCents;
    return scopePriority(b.scope) - scopePriority(a.scope);
  });
}

export async function computeAutoDiscountDetail(args: {
  when: Date;
  item: DiscountItem;
  promoCode?: string | null;
  customerCountry?: string | null;
  promotionsEnabled?: boolean;
}): Promise<DiscountExplain> {
  if (args.promotionsEnabled === false) return { discountCents: 0, rule: null };
  if (!args.item) return { discountCents: 0, rule: null };

  let chosenPool: DiscountRuleLite[];

  if (args.promoCode) {
    const promoPool = await findApplicableRules({
      when: args.when,
      item: args.item,
      customerCountry: args.customerCountry,
      promoCode: args.promoCode,
    });
    const manualOptionPromos = promoPool.filter((rule) => rule.scope === "OPTION");

    chosenPool =
      manualOptionPromos.length > 0
        ? manualOptionPromos
        : await findApplicableRules({
            when: args.when,
            item: args.item,
            customerCountry: args.customerCountry,
          });
  } else {
    chosenPool = await findApplicableRules({
      when: args.when,
      item: args.item,
      customerCountry: args.customerCountry,
    });
  }

  const chosen = pickBestRule(chosenPool, args.item);
  if (!chosen.rule || chosen.discountCents <= 0) return { discountCents: 0, rule: null };

  return {
    discountCents: chosen.discountCents,
    rule: toRuleSummary(chosen.rule),
  };
}
