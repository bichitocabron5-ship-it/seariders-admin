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

  const category = normalizeCategory(input.serviceCategory);
  if (category !== "JETCAR" && category !== "BOAT") return false;

  const mode = String(input.runMode ?? "").toUpperCase();

  if (Boolean(input.isLicense)) {
    return mode === "SOLO" || mode === "TEST";
  }

  return mode === "MONITOR";
}
