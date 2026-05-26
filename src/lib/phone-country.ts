import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

function normalizeCountry(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "";
  return isSupportedCountry(normalized as CountryCode) ? normalized : "";
}

export function resolvePhoneFieldState(phone: string | null | undefined, fallbackCountry?: string | null) {
  const rawPhone = String(phone ?? "").trim();
  const normalizedFallbackCountry = normalizeCountry(fallbackCountry);

  if (!rawPhone) {
    return {
      dialCountry: normalizedFallbackCountry,
      localPhone: "",
    };
  }

  const parsed =
    parsePhoneNumberFromString(rawPhone) ??
    (normalizedFallbackCountry
      ? parsePhoneNumberFromString(rawPhone, normalizedFallbackCountry as CountryCode)
      : null);

  if (!parsed) {
    return {
      dialCountry: normalizedFallbackCountry,
      localPhone: rawPhone,
    };
  }

  return {
    dialCountry: normalizeCountry(parsed.country) || normalizedFallbackCountry,
    localPhone: parsed.nationalNumber || rawPhone,
  };
}

export function buildStoredPhoneNumber(localPhone: string | null | undefined, dialCountry?: string | null) {
  const rawPhone = String(localPhone ?? "").trim();
  if (!rawPhone) return "";

  const normalizedDialCountry = normalizeCountry(dialCountry);
  const parsed =
    parsePhoneNumberFromString(rawPhone) ??
    (normalizedDialCountry
      ? parsePhoneNumberFromString(rawPhone, normalizedDialCountry as CountryCode)
      : null);

  if (parsed) return parsed.format("E.164");
  if (rawPhone.startsWith("00")) return `+${rawPhone.slice(2).replace(/\D/g, "")}`;
  if (rawPhone.startsWith("+")) return `+${rawPhone.slice(1).replace(/\D/g, "")}`;
  return rawPhone;
}
