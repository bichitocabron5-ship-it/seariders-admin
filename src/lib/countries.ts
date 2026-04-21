// src/lib/countries.ts
import countries from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";
import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

countries.registerLocale(es);

export type CountryOption = { value: string; label: string };

export function getCountryOptionsEs(): CountryOption[] {
  const names = countries.getNames("es", { select: "official" }); // { ES: "España", ... }

  return Object.entries(names)
    .map(([code, name]) => ({ value: code, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function isValidCountryIso2(code: string) {
  const up = (code || "").toUpperCase();
  return Boolean(countries.isValid(up));
}

export function getDialCodeForCountry(code: string | null | undefined) {
  const up = String(code ?? "").trim().toUpperCase();
  if (!up || !isSupportedCountry(up as CountryCode)) return "";
  try {
    return getCountryCallingCode(up as CountryCode);
  } catch {
    return "";
  }
}
