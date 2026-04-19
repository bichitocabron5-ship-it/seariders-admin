import { JetskiLicenseMode, PricingTier } from "@prisma/client";

export function isLicensedJetskiMode(mode: JetskiLicenseMode | null | undefined) {
  return mode === JetskiLicenseMode.GREEN_LIMITED || mode === JetskiLicenseMode.YELLOW_UNLIMITED;
}

export function resolveJetskiLicenseMode(args: {
  category?: string | null;
  jetskiLicenseMode?: JetskiLicenseMode | null;
  isLicense?: boolean | null;
}) {
  const category = String(args.category ?? "").trim().toUpperCase();
  if (category !== "JETSKI") {
    return JetskiLicenseMode.NONE;
  }

  if (args.jetskiLicenseMode && args.jetskiLicenseMode !== JetskiLicenseMode.NONE) {
    return args.jetskiLicenseMode;
  }

  return args.isLicense ? JetskiLicenseMode.YELLOW_UNLIMITED : JetskiLicenseMode.NONE;
}

export function resolvePricingTierForJetskiMode(mode: JetskiLicenseMode | null | undefined) {
  return mode === JetskiLicenseMode.GREEN_LIMITED ? PricingTier.RESIDENT : PricingTier.STANDARD;
}

export function defaultJetskiLicenseModeForService(isLicenseService: boolean | null | undefined) {
  return isLicenseService ? JetskiLicenseMode.YELLOW_UNLIMITED : JetskiLicenseMode.NONE;
}
