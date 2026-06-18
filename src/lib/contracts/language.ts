import type { PublicLanguage } from "@/lib/public-links/i18n";

export function parseStoredContractLanguage(
  value: string | null | undefined
): PublicLanguage | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "es" || normalized === "en" || normalized === "fr") {
    return normalized;
  }

  return null;
}

export function resolveContractRenderLanguage(args: {
  requestedLanguage?: PublicLanguage | null;
  signedLanguage?: string | null;
}): PublicLanguage {
  return (
    parseStoredContractLanguage(args.signedLanguage) ??
    args.requestedLanguage ??
    "es"
  );
}
