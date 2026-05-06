function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

export function canShareMonitorAssetWithReservation(input: {
  runKind: string | null | undefined;
  runMode: string | null | undefined;
  serviceCategory: string | null | undefined;
  isLicense: boolean | null | undefined;
}) {
  if (String(input.runKind ?? "").toUpperCase() !== "NAUTICA") return false;
  if (String(input.runMode ?? "").toUpperCase() !== "MONITOR") return false;
  if (Boolean(input.isLicense)) return false;

  const category = normalizeCategory(input.serviceCategory);
  return category === "JETCAR" || category === "BOAT";
}
