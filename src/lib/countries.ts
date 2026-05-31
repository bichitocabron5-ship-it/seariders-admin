// src/lib/countries.ts
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
import es from "i18n-iso-countries/langs/es.json" with { type: "json" };
import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

countries.registerLocale(en);
countries.registerLocale(es);

export type CountryOption = {
  value: string;
  label: string;
  labelEn?: string;
  searchLabels?: string[];
};

export type CountryDialCodeOption = CountryOption & {
  dialCode: string;
  flag: string;
  searchText: string;
};

const FREQUENT_PHONE_COUNTRIES = ["ES", "FR", "DE", "IT", "GB", "NL", "BE"] as const;

function uniqueClean(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const clean = String(value ?? "").trim();
    if (!clean) continue;
    const key = normalizeCountrySearchText(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function countryNameList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function normalizeCountrySearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getCountryOptionsEs(): CountryOption[] {
  const namesEs = countries.getNames("es", { select: "official" });
  const namesEn = countries.getNames("en", { select: "official" });
  const aliasesEs = countries.getNames("es", { select: "all" });
  const aliasesEn = countries.getNames("en", { select: "all" });

  return Object.entries(namesEs)
    .map(([code, name]) => {
      const label = String(name ?? code);
      const labelEn = String(namesEn[code] ?? "");
      const searchLabels = uniqueClean([
        label,
        labelEn,
        ...countryNameList(aliasesEs[code]),
        ...countryNameList(aliasesEn[code]),
        code,
        code === "GB" ? "UK" : null,
      ]);

      return { value: code, label, labelEn, searchLabels };
    })
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

export function getCountryFlagEmoji(code: string | null | undefined) {
  const up = String(code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return "";

  return String.fromCodePoint(
    ...[...up].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );
}

export function getCountryDialCodeOptions(countryOptions: CountryOption[]): CountryDialCodeOption[] {
  const frequentRank = new Map<string, number>(FREQUENT_PHONE_COUNTRIES.map((code, index) => [code, index]));

  return countryOptions
    .map((option) => {
      const value = String(option.value ?? "").trim().toUpperCase();
      const dialCode = String(getDialCodeForCountry(value));
      if (!value || !dialCode) return null;

      const searchLabels = uniqueClean([
        option.label,
        option.labelEn,
        ...(option.searchLabels ?? []),
        value,
        value === "GB" ? "UK" : null,
        dialCode,
        `+${dialCode}`,
      ]);

      return {
        ...option,
        value,
        dialCode,
        flag: getCountryFlagEmoji(value),
        searchText: searchLabels.map(normalizeCountrySearchText).join(" "),
      };
    })
    .filter((option): option is CountryDialCodeOption => option !== null)
    .sort((a, b) => {
      const rankA = frequentRank.get(a.value);
      const rankB = frequentRank.get(b.value);

      if (rankA != null && rankB != null) return rankA - rankB;
      if (rankA != null) return -1;
      if (rankB != null) return 1;

      return a.label.localeCompare(b.label, "es");
    });
}
