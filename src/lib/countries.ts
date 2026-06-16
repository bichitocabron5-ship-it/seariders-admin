// src/lib/countries.ts
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
import es from "i18n-iso-countries/langs/es.json" with { type: "json" };
import fr from "i18n-iso-countries/langs/fr.json" with { type: "json" };
import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

countries.registerLocale(en);
countries.registerLocale(es);
countries.registerLocale(fr);

export type CountryOption = {
  value: string;
  label: string;
  labelEn?: string;
  labelEs?: string;
  labelFr?: string;
  searchLabels?: string[];
};

export type CountryDialCodeOption = CountryOption & {
  dialCode: string;
  flag: string;
  searchText: string;
};

const FREQUENT_PHONE_COUNTRIES = ["ES", "FR", "DE", "IT", "GB", "NL", "BE"] as const;
export type CountryLanguage = "es" | "en" | "fr";

export function normalizeCountryLanguage(language: string | null | undefined): CountryLanguage {
  if (language === "en") return "en";
  if (language === "fr") return "fr";
  return "es";
}

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

export function getCountryOptions(language: CountryLanguage = "es"): CountryOption[] {
  const locale = normalizeCountryLanguage(language);
  const names = countries.getNames(locale, { select: "official" });
  const namesEs = countries.getNames("es", { select: "official" });
  const namesEn = countries.getNames("en", { select: "official" });
  const namesFr = countries.getNames("fr", { select: "official" });
  const aliasesEs = countries.getNames("es", { select: "all" });
  const aliasesEn = countries.getNames("en", { select: "all" });
  const aliasesFr = countries.getNames("fr", { select: "all" });

  return Object.entries(names)
    .map(([code, name]) => {
      const value = code.toUpperCase();
      const label = String(name ?? code);
      const labelEn = String(namesEn[code] ?? "");
      const labelEs = String(namesEs[code] ?? "");
      const labelFr = String(namesFr[code] ?? "");
      const searchLabels = uniqueClean([
        label,
        labelEn,
        labelEs,
        labelFr,
        ...countryNameList(aliasesEs[code]),
        ...countryNameList(aliasesEn[code]),
        ...countryNameList(aliasesFr[code]),
        value,
        value === "GB" ? "UK" : null,
        value === "US" ? "USA" : null,
      ]);

      return { value, label, labelEn, labelEs, labelFr, searchLabels };
    })
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function getCountryOptionsEs(): CountryOption[] {
  return getCountryOptions("es");
}

export function getCountryOptionsEn(): CountryOption[] {
  return getCountryOptions("en");
}

export function getCountryOptionsFr(): CountryOption[] {
  return getCountryOptions("fr");
}

export function getCountryOptionLabel(option: CountryOption, language: string | null | undefined = "es") {
  const locale = normalizeCountryLanguage(language);
  if (locale === "en") return option.labelEn || option.label || option.value;
  if (locale === "fr") return option.labelFr || option.label || option.value;
  return option.labelEs || option.label || option.value;
}

export function isValidCountryIso2(code: string) {
  const up = (code || "").toUpperCase();
  return Boolean(countries.isValid(up));
}

export function resolveCountryIso2(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && isValidCountryIso2(upper)) return upper;
  if (upper === "UK") return "GB";
  if (upper === "USA") return "US";

  const alpha2En = countries.getAlpha2Code(raw, "en");
  if (alpha2En && isValidCountryIso2(alpha2En)) return alpha2En.toUpperCase();

  const alpha2Es = countries.getAlpha2Code(raw, "es");
  if (alpha2Es && isValidCountryIso2(alpha2Es)) return alpha2Es.toUpperCase();

  const alpha2Fr = countries.getAlpha2Code(raw, "fr");
  if (alpha2Fr && isValidCountryIso2(alpha2Fr)) return alpha2Fr.toUpperCase();

  const normalized = normalizeCountrySearchText(raw);
  for (const option of getCountryOptions("es")) {
    const labels = option.searchLabels ?? [option.label, option.labelEn, option.labelEs, option.labelFr, option.value];
    if (labels.map(normalizeCountrySearchText).includes(normalized)) return option.value;
  }

  return null;
}

export function getCountryLabel(value: string | null | undefined, language: CountryLanguage = "es") {
  const iso = resolveCountryIso2(value);
  if (!iso) return String(value ?? "").trim();
  return getCountryOptions(language).find((option) => option.value === iso)?.label ?? iso;
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
        option.labelFr,
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
