import { getEnPublicCopy } from "./locales/en";
import { getEsPublicCopy } from "./locales/es";
import { getFrPublicCopy } from "./locales/fr";
import type { PublicCopy } from "./locales/types";

export type PublicLanguage = "es" | "en" | "fr";

export const PUBLIC_LANGUAGE_OPTIONS: Array<{ value: PublicLanguage; label: string }> = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

export function normalizePublicLanguage(value: string | null | undefined): PublicLanguage {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "fr") return "fr";
  return "es";
}

export function getDefaultPublicLanguage(country?: string | null): PublicLanguage {
  const normalized = String(country ?? "").trim().toUpperCase();
  if (normalized === "FR") return "fr";
  if (normalized && normalized !== "ES") return "en";
  return "es";
}

export function appendPublicLanguage(url: string, language: PublicLanguage) {
  const isAbsolute = /^https?:\/\//i.test(url);
  const next = new URL(url, isAbsolute ? undefined : "http://localhost");
  next.searchParams.set("lang", language);
  return isAbsolute ? next.toString() : `${next.pathname}${next.search}`;
}

function localeForLanguage(language: PublicLanguage) {
  if (language === "en") return "en-GB";
  if (language === "fr") return "fr-FR";
  return "es-ES";
}

export function formatPublicDate(value: string | null, language: PublicLanguage) {
  if (!value) {
    if (language === "en") return "No date";
    if (language === "fr") return "Pas de date";
    return "Sin fecha";
  }
  return new Date(value).toLocaleDateString(localeForLanguage(language));
}

export function formatPublicTime(value: string | null, language: PublicLanguage) {
  if (!value) {
    if (language === "en") return "No time";
    if (language === "fr") return "Pas d'heure";
    return "Sin hora";
  }
  return new Date(value).toLocaleTimeString(localeForLanguage(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPublicCopy(language: PublicLanguage): PublicCopy {
  if (language === "en") return getEnPublicCopy();
  if (language === "fr") return getFrPublicCopy();
  return getEsPublicCopy();
}
