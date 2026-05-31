import { getDialCodeForCountry } from "./countries";

export function normalizePhoneForWhatsApp(phone: string | null | undefined, country?: string | null) {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const normalized = raw.slice(1).replace(/\D/g, "");
    return normalized.length >= 8 ? normalized : null;
  }

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 ? digits : null;
  }

  const dialCode = getDialCodeForCountry(country);
  if (!dialCode) return digits.length >= 8 ? digits : null;

  const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;
  const normalized = `${dialCode}${localDigits}`;
  return normalized.length >= 8 ? normalized : null;
}
