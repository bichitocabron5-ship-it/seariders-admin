type SubmitCartItem = {
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
};

function normTrim(v: unknown) {
  return String(v ?? "").trim();
}

function putIfNonEmpty(obj: Record<string, unknown>, key: string, v: unknown) {
  const t = normTrim(v);
  if (t.length > 0) obj[key] = t;
}

export function buildEditUpdateBody(args: {
  pax: number;
  isLicense: boolean;
  channelId: string;
  dateStr: string;
  timeStr: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  companions: number;
  cartItems: SubmitCartItem[];
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
    channelId: args.channelId || null,
    activityDate: args.dateStr,
    time: args.timeStr?.trim() ? args.timeStr.trim() : null,
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: Number(args.quantity),
    companionsCount: Number(args.companions) || 0,
  };

  if (args.cartItems.length > 0) {
    body.items = args.cartItems.map((ci) => ({
      serviceId: ci.serviceId,
      optionId: ci.optionId,
      quantity: Number(ci.quantity),
      pax: Number(ci.pax),
    }));
  }

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
}) {
  return {
    customerName: args.customerName.trim(),
    customerPhone: args.customerPhone.trim(),
    customerEmail: args.customerEmail.trim(),
    customerCountry: (args.customerCountry || "").trim().toUpperCase() || null,
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
}

export function buildItemsToSend(args: {
  isPackMode: boolean;
  cartItems: SubmitCartItem[];
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
}) {
  return !args.isPackMode && args.cartItems.length > 0
    ? args.cartItems.map((it) => ({
        serviceId: it.serviceId,
        optionId: it.optionId,
        quantity: Number(it.quantity),
        pax: Number(it.pax),
      }))
    : [
        {
          serviceId: args.serviceId,
          optionId: args.optionId,
          quantity: Number(args.quantity),
          pax: Number(args.pax),
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
  itemsToSend: Array<{ serviceId: string; optionId: string; quantity: number; pax: number }>;
}) {
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
    pax: Number(args.pax),
    companionsCount: Number(args.companions) || 0,
    isLicense: Boolean(args.isLicense),
    manualDiscountCents: args.manualDiscountCents,
    manualDiscountReason: args.manualDiscountReason?.trim() || null,
    items: args.itemsToSend,
  };
}
