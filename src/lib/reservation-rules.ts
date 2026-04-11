type ContractItem = {
  quantity: number | null;
  isExtra: boolean;
  service: { category: string | null } | null;
};

export function needsContractForCategory(categoryRaw: string | null | undefined, isLicense: boolean) {
  const cat = String(categoryRaw ?? "").toUpperCase();
  const isJetski = cat === "JETSKI";
  const isBoat = cat === "BOAT";
  return isJetski || (isBoat && isLicense) || Boolean(isLicense);
}

export function computeRequiredContractUnits(input: {
  quantity: number | null;
  isLicense: boolean;
  serviceCategory?: string | null;
  items: ContractItem[];
}) {
  if (input.items && input.items.length > 0) {
    const mainItems = input.items.filter((it) => !it.isExtra);
    let sum = 0;
    for (const it of mainItems) {
      const qty = Number(it.quantity ?? 0);
      const cat = it.service?.category ?? "";
      if (needsContractForCategory(cat, input.isLicense)) sum += qty;
    }
    if (sum > 0) return sum;
  }

  const qty = Math.max(0, Number(input.quantity ?? 0));
  if (input.serviceCategory === undefined) return qty; // compat legacy when category is not loaded
  return needsContractForCategory(input.serviceCategory, input.isLicense) ? qty : 0;
}

export function needsPlatformUnitForCategory(categoryRaw: string | null | undefined) {
  const cat = String(categoryRaw ?? "").toUpperCase();
  if (!cat) return false;
  return cat !== "EXTRA" && cat !== "BAR";
}

export function computeRequiredPlatformUnits(input: {
  quantity: number | null;
  serviceCategory?: string | null;
  items: ContractItem[];
}) {
  if (input.items && input.items.length > 0) {
    const mainItems = input.items.filter((it) => !it.isExtra);
    let sum = 0;
    for (const it of mainItems) {
      const qty = Number(it.quantity ?? 0);
      const cat = it.service?.category ?? "";
      if (needsPlatformUnitForCategory(cat)) sum += qty;
    }
    if (sum > 0) return sum;
  }

  const qty = Math.max(0, Number(input.quantity ?? 0));
  if (input.serviceCategory === undefined) return qty; // compat legacy when category is not loaded
  return needsPlatformUnitForCategory(input.serviceCategory) ? qty : 0;
}
