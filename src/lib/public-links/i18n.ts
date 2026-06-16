import { getEnPublicCopy } from "./locales/en";
import { getEsPublicCopy } from "./locales/es";
import type { PublicCopy } from "./locales/types";

export type PublicLanguage = "es" | "en";

export const PUBLIC_LANGUAGE_OPTIONS: Array<{ value: PublicLanguage; label: string }> = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export function normalizePublicLanguage(value: string | null | undefined): PublicLanguage {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "fr") return "en";
  return "es";
}

export function getDefaultPublicLanguage(country?: string | null): PublicLanguage {
  const normalized = String(country ?? "").trim().toUpperCase();
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
  return "es-ES";
}

export function formatPublicDate(value: string | null, language: PublicLanguage) {
  if (!value) return language === "en" ? "No date" : "Sin fecha";
  return new Date(value).toLocaleDateString(localeForLanguage(language));
}

export function formatPublicTime(value: string | null, language: PublicLanguage) {
  if (!value) return language === "en" ? "No time" : "Sin hora";
  return new Date(value).toLocaleTimeString(localeForLanguage(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPublicCopy(language: PublicLanguage): PublicCopy {
  if (language === "en") return getEnPublicCopy();
  return getEsPublicCopy();
}
