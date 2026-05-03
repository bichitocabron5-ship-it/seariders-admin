import { clampBps } from "@/lib/commission";

type SubmitCartItem = {
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  promoCode?: string | null;
};

function normTrim(v: unknown) {
  return String(v ?? "").trim();
}

function toSafePositiveInt(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.trunc(n));
}

function toSafeNonNegativeInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

function putIfNonEmpty(obj: Record<string, unknown>, key: string, v: unknown) {
  const t = normTrim(v);
  if (t.length > 0) obj[key] = t;
}

export function buildEditUpdateBody(args: {
  pax: number;
  isLicense: boolean;
  jetskiLicenseMode: "NONE" | "GREEN_LIMITED" | "YELLOW_UNLIMITED";
  pricingTier: "STANDARD" | "RESIDENT";
  channelId: string;
  dateStr: string;
  timeStr: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  companions: number;
  cartItems: SubmitCartItem[];
  singlePromoCode?: string | null;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerPostalCode: string;
  customerBirthDate: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
}) {
  const body: Record<string, unknown> = {
    pax: Number(args.pax),
    isLicense: Boolean(args.isLicense),
    jetskiLicenseMode: args.jetskiLicenseMode,
    pricingTier: args.pricingTier,
    channelId: args.channelId || null,
    activityDate: args.dateStr,
    time: args.timeStr?.trim() ? args.timeStr.trim() : null,
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: Number(args.quantity),
    companionsCount: Number(args.companions) || 0,
  };

  body.items = (args.cartItems.length > 0 ? args.cartItems : [{
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: Number(args.quantity),
    pax: Number(args.pax),
    promoCode: args.singlePromoCode ?? null,
  }]).map((ci) => ({
    serviceId: ci.serviceId,
    optionId: ci.optionId,
    quantity: Number(ci.quantity),
    pax: Number(ci.pax),
    promoCode: ci.promoCode ?? null,
  }));

  putIfNonEmpty(body, "customerPhone", args.customerPhone);
  putIfNonEmpty(body, "customerEmail", args.customerEmail);
  putIfNonEmpty(body, "customerCountry", args.customerCountry.toUpperCase());
  putIfNonEmpty(body, "customerAddress", args.customerAddress);
  putIfNonEmpty(body, "customerPostalCode", args.customerPostalCode);
  putIfNonEmpty(body, "customerBirthDate", args.customerBirthDate ? `${args.customerBirthDate}T12:00:00.000Z` : null);
  putIfNonEmpty(body, "customerDocType", args.customerDocType);
  putIfNonEmpty(body, "customerDocNumber", args.customerDocNumber);
  putIfNonEmpty(body, "marketing", args.marketingSource);

  if (args.isLicense) {
    putIfNonEmpty(body, "licenseSchool", args.licenseSchool);
    putIfNonEmpty(body, "licenseType", args.licenseType);
    putIfNonEmpty(body, "licenseNumber", args.licenseNumber);
  } else {
    body.licenseSchool = null;
    body.licenseType = null;
    body.licenseNumber = null;
  }

  return body;
}

export function buildFormalizeBody(args: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerPostalCode: string;
  customerBirthDate: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  isVoucherFormalizeFlow: boolean;
  serviceId: string;
  optionId: string;
  channelId: string;
  quantity: number;
  pax: number;
  companions: number;
  dateStr: string;
  timeStr: string;
  isLicense?: boolean;
  jetskiLicenseMode?: "NONE" | "GREEN_LIMITED" | "YELLOW_UNLIMITED";
  pricingTier?: "STANDARD" | "RESIDENT";
  licenseSchool?: string;
  licenseType?: string;
  licenseNumber?: string;
  cartItems?: SubmitCartItem[];
  promoCode?: string | null;
}) {
  const body: Record<string, unknown> = {
    customerName: args.customerName.trim(),
    customerPhone: args.customerPhone.trim(),
    customerEmail: args.customerEmail.trim(),
    customerCountry: (args.customerCountry || "").trim().toUpperCase() || null,
    customerAddress: args.customerAddress.trim() || null,
    customerPostalCode: args.customerPostalCode.trim() || null,
    customerBirthDate: args.customerBirthDate ? `${args.customerBirthDate}T12:00:00.000Z` : null,
    customerDocType: args.customerDocType.trim() || null,
    customerDocNumber: args.customerDocNumber.trim() || null,
    marketing: args.marketingSource.trim() || null,
    serviceId: args.isVoucherFormalizeFlow ? undefined : args.serviceId,
    optionId: args.isVoucherFormalizeFlow ? undefined : args.optionId,
    channelId: args.channelId || null,
    quantity: args.isVoucherFormalizeFlow ? undefined : Number(args.quantity),
    pax: args.isVoucherFormalizeFlow ? undefined : Number(args.pax),
    companionsCount: Number(args.companions) || 0,
    activityDate: args.dateStr,
    time: args.timeStr?.trim() ? args.timeStr : null,
  };

  if (args.isLicense !== undefined) body.isLicense = Boolean(args.isLicense);
  if (args.jetskiLicenseMode !== undefined) body.jetskiLicenseMode = args.jetskiLicenseMode;
  if (args.pricingTier !== undefined) body.pricingTier = args.pricingTier;

  if (args.isLicense) {
    body.licenseSchool = args.licenseSchool?.trim() || null;
    body.licenseType = args.licenseType?.trim() || null;
    body.licenseNumber = args.licenseNumber?.trim() || null;
  } else if (args.isLicense !== undefined) {
    body.licenseSchool = null;
    body.licenseType = null;
    body.licenseNumber = null;
  }

  if (!args.isVoucherFormalizeFlow) {
    body.items = (args.cartItems && args.cartItems.length > 0
      ? args.cartItems
      : [
          {
            serviceId: args.serviceId,
            optionId: args.optionId,
            quantity: Number(args.quantity),
            pax: Number(args.pax),
            promoCode: args.promoCode ?? null,
          },
        ]).map((ci) => ({
      serviceId: ci.serviceId,
      optionId: ci.optionId,
      quantity: Number(ci.quantity),
      pax: Number(ci.pax),
      promoCode: ci.promoCode ?? null,
    }));
  }

  return body;
}

export function buildItemsToSend(args: {
  isPackMode: boolean;
  cartItems: SubmitCartItem[];
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  promoCode?: string | null;
}) {
  return !args.isPackMode && args.cartItems.length > 0
    ? args.cartItems.map((it) => ({
      serviceId: it.serviceId,
      optionId: it.optionId,
      quantity: Number(it.quantity),
      pax: Number(it.pax),
      promoCode: it.promoCode ?? null,
    }))
    : [
        {
          serviceId: args.serviceId,
          optionId: args.optionId,
          quantity: Number(args.quantity),
          pax: Number(args.pax),
          promoCode: args.promoCode ?? null,
        },
      ];
}

export function buildCreateBody(args: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerPostalCode: string;
  customerBirthDate: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  isLicense: boolean;
  jetskiLicenseMode: "NONE" | "GREEN_LIMITED" | "YELLOW_UNLIMITED";
  pricingTier: "STANDARD" | "RESIDENT";
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
  channelId: string;
  dateStr: string;
  time: string;
  pax: number;
  companions: number;
  manualDiscountCents: number;
  manualDiscountReason: string;
  discountResponsibility: "COMPANY" | "PROMOTER" | "SHARED";
  promoterDiscountShareBps: number;
  itemsToSend: Array<{ serviceId: string; optionId: string; quantity: number; pax: number; promoCode?: string | null }>;
}) {
  const sanitizedPromoterDiscountShareBps = clampBps(args.promoterDiscountShareBps);
  const sanitizedManualDiscountCents = toSafeNonNegativeInt(args.manualDiscountCents);

  return {
    customerName: args.customerName.trim(),
    customerPhone: args.customerPhone.trim() || null,
    customerEmail: args.customerEmail.trim() || null,
    customerCountry: (args.customerCountry || "ES").trim().toUpperCase(),
    customerAddress: args.customerAddress.trim() || null,
    customerPostalCode: args.customerPostalCode.trim() || null,
    customerBirthDate: args.customerBirthDate ? `${args.customerBirthDate}T12:00:00.000Z` : null,
    customerDocType: args.customerDocType.trim() || null,
    customerDocNumber: args.customerDocNumber.trim() || null,
    marketing: args.marketingSource.trim() || null,
    licenseSchool: args.isLicense ? (args.licenseSchool.trim() || null) : null,
    licenseType: args.isLicense ? (args.licenseType.trim() || null) : null,
    licenseNumber: args.isLicense ? (args.licenseNumber.trim() || null) : null,
    channelId: args.channelId,
    date: args.dateStr,
    time: args.time,
    pax: toSafePositiveInt(args.pax),
    companionsCount: toSafeNonNegativeInt(args.companions),
    isLicense: Boolean(args.isLicense),
    jetskiLicenseMode: args.jetskiLicenseMode,
    pricingTier: args.pricingTier,
    manualDiscountCents: sanitizedManualDiscountCents,
    manualDiscountReason: args.manualDiscountReason?.trim() || null,
    discountResponsibility: args.discountResponsibility,
    promoterDiscountShareBps: sanitizedPromoterDiscountShareBps,
    items: args.itemsToSend.map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId,
      quantity: toSafePositiveInt(item.quantity),
      pax: toSafePositiveInt(item.pax),
      promoCode: item.promoCode ?? null,
    })),
  };
}
