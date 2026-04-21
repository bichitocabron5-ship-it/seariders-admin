// src/lib/countries.ts
import countries from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";

countries.registerLocale(es);

export type CountryOption = { value: string; label: string };

const COUNTRY_DIAL_CODES: Record<string, string> = {
  ES: "34",
  FR: "33",
  DE: "49",
  IT: "39",
  PT: "351",
  GB: "44",
  IE: "353",
  NL: "31",
  BE: "32",
  CH: "41",
  AT: "43",
  US: "1",
  CA: "1",
  AU: "61",
  NZ: "64",
  DK: "45",
  SE: "46",
  NO: "47",
  FI: "358",
  PL: "48",
  CZ: "420",
  SK: "421",
  HU: "36",
  RO: "40",
  BG: "359",
  HR: "385",
  SI: "386",
  GR: "30",
  CY: "357",
  MT: "356",
  LU: "352",
  AD: "376",
};

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
  return COUNTRY_DIAL_CODES[up] ?? "";
}
